const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationCode(toEmail, code) {
  await transporter.sendMail({
    from: `"MyPAWS Login" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your MyPAWS verification code',
    text: `Your verification code is ${code}. It expires in 10 minutes. If you did not try to log in, you can ignore this email.`,
  });
}

module.exports = { sendVerificationCode };