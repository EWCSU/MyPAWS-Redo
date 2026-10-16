require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

transporter
  .verify()
  .then(() => console.log('Gmail accepted the login. Email sending should work.'))
  .catch((err) => console.log('Gmail rejected it:', err.message));