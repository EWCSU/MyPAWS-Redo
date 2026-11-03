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

async function sendPasswordResetLink(toEmail, token) {
    const resetUrl = new URL(
        "/LoginUI/ResetPassword.html",
        process.env.APP_BASE_URL || "http://localhost:3000"
    );

    resetUrl.searchParams.set("token", token);

    await transporter.sendMail({
        from: `"MyPAWS Security" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: "Reset Your MyPAWS Password",
        text:
            "We received a request to reset your MyPAWS password.\n\n" +
            "Click the link below to create a new password:\n\n" +
            resetUrl.toString() + "\n\n" +
            "This link expires in 10 minutes and can only be used once.\n\n" +
            "If you did not request this, you can ignore this email."
    });
}

module.exports = {
    sendVerificationCode,
    sendPasswordResetLink
};