const nodemailer = require('nodemailer');

function createTransporter() {
  const requiredKeys = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
  const missing = requiredKeys.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing email configuration: ${missing.join(', ')}`);
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendOtpEmail(email, otp, name) {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Echoes of CUET - Verify your account',
    text: `Hello ${name},\n\nYour verification OTP is: ${otp}\n\nThis code is required to complete your registration.`,
    html: `<p>Hello ${name},</p><p>Your verification OTP is: <strong>${otp}</strong></p><p>This code is required to complete your registration.</p>`,
  });
}

module.exports = {
  sendOtpEmail,
};
