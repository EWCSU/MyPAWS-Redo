const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const requireAuth = require('../middleware/requireAuth');

const crypto = require('crypto'); // built into node tht gives us a random # generator
const { sendVerificationCode } = require('../utils/mailer'); // imports the email function

const router = express.Router();
const prisma = new PrismaClient();

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' },
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts, please try again later.' },
});

const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const STUDENT_EMAIL_DOMAIN = process.env.STUDENT_EMAIL_DOMAIN || 'coyote.csusb.edu';

// "Student ID" becomes "StudentID@coyote.csusb.edu". Full emails pass through unchanged.
function toEmail(username) {
  const value = String(username || '').trim().toLowerCase();
  return value.includes('@') ? value : `${value}@${STUDENT_EMAIL_DOMAIN}`;
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}


router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const email = toEmail(username);
    const user = await prisma.user.findUnique({ where: { email } });
    
    const genericFail = () => res.status(401).json({ error: 'Invalid credentials.' });

    if (!user) return genericFail();

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(423).json({ error: 'Account temporarily locked. Try again later.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_TIME_MS) : null,
        },
      });

      return genericFail();
    }

    // Password is correct: generate a 6-digit code instead of logging in right away
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(code, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        twoFactorCode: codeHash,
        twoFactorExpires: new Date(Date.now() + CODE_EXPIRY_MS),
      },
    });

    try {
      await sendVerificationCode(user.email, code);
    } catch (mailErr) {
      console.error('Email send error:', mailErr);
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorCode: null, twoFactorExpires: null },
      });
      return res.status(500).json({ error: 'Could not send verification code.' });
    }

    return res.json({ requiresVerification: true, email: user.email });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post('/verify-code', verifyLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const failure = () => res.status(401).json({ error: 'Invalid or expired code.' });

    if (!user || !user.twoFactorCode || !user.twoFactorExpires) return failure();
    if (user.twoFactorExpires < new Date()) return failure();

    const codeMatches = await bcrypt.compare(String(code), user.twoFactorCode);
    if (!codeMatches) return failure();

    // Code is valid: clear it so it can't be reused, then log the user in
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorCode: null, twoFactorExpires: null },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '2h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000,
    });

    return res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Verify error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out.' });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, createdAt: true },
  });
  return res.json({ user });
});

module.exports = router;