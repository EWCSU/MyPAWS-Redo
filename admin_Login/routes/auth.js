
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
const prisma = new PrismaClient();

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' }
});

const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPassword = password =>
  typeof password === 'string' &&
  password.length >= 8 &&
  /[A-Za-z]/.test(password) &&
  /\d/.test(password);

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email and password are required.' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include a letter and a number.'
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      return res.status(409).json({ error: 'Unable to create account with those details.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { email, password_hash, role: 'student' },
      select: { user_id: true, email: true }
    });

    return res.status(201).json({ user });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.locked_until && user.locked_until > new Date()) {
      return res.status(423).json({
        error: 'Account temporarily locked. Try again later.'
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      const attempts = user.failed_login_attempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

      await prisma.user.update({
        where: { user_id: user.user_id },
        data: {
          failed_login_attempts: shouldLock ? 0 : attempts,
          locked_until: shouldLock ? new Date(Date.now() + LOCK_TIME_MS) : null
        }
      });

      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const twoFactorCode = crypto.randomInt(100000, 1000000).toString();
    const twoFactorExpires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        failed_login_attempts: 0,
        locked_until: null,
        two_factor_code: twoFactorCode,
        two_factor_expires: twoFactorExpires
      }
    });

    console.log('2FA code:', twoFactorCode);

    return res.json({
      message: 'Verification code required.',
      user_id: user.user_id
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post('/verify-2fa', async (req, res) => {
  try {
    const { user_id, code } = req.body;

    if (!user_id || !code) {
      return res.status(400).json({
        error: 'User ID and verification code are required.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { user_id: Number(user_id) }
    });

    if (
      !user ||
      user.two_factor_code !== code ||
      !user.two_factor_expires ||
      user.two_factor_expires < new Date()
    ) {
      return res.status(401).json({ error: 'Invalid or expired verification code.' });
    }

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: { two_factor_code: null, two_factor_expires: null }
    });

    const token = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000
    });

    return res.json({
      message: 'Login successful.',
      user: { user_id: user.user_id, email: user.email }
    });
  } catch (err) {
    console.error('2FA error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    const message = 'If the account exists, reset instructions will be sent.';
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return res.json({ message });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires
      }
    });

    console.log('Reset token:', resetToken);

    return res.json({ message });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        error: 'Email, token, and new password are required.'
      });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include a letter and a number.'
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (
      !user ||
      user.reset_token !== token ||
      !user.reset_token_expires ||
      user.reset_token_expires < new Date()
    ) {
      return res.status(401).json({ error: 'Invalid or expired reset token.' });
    }

    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        password_hash,
        reset_token: null,
        reset_token_expires: null
      }
    });

    return res.json({ message: 'Password reset successful.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out.' });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: req.userId },
      select: { user_id: true, email: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('User error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
