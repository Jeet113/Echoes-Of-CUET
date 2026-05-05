const nodemailer = require('nodemailer');

function createTransporter() {
  const requiredKeys = ['BREVO_SMTP_HOST', 'BREVO_SMTP_PORT', 'BREVO_SMTP_USER', 'BREVO_SMTP_PASS'];
  const missing = requiredKeys.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing email configuration: ${missing.join(', ')}`);
  }

  return nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST,
    port: Number(process.env.BREVO_SMTP_PORT),
    secure: Number(process.env.BREVO_SMTP_PORT) === 465,
    auth: {
      user: process.env.BREVO_SMTP_USER,
      pass: process.env.BREVO_SMTP_PASS,
    },
  });
}

async function sendOtpEmail(email, otp, name) {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || process.env.BREVO_SMTP_USER;

  try {
    await transporter.verify();
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Echoes of CUET - Verify your account',
      text: `Hello ${name},\n\nYour verification OTP is: ${otp}\n\nThis code is required to complete your registration.`,
      html: `<p>Hello ${name},</p><p>Your verification OTP is: <strong>${otp}</strong></p><p>This code is required to complete your registration.</p>`,
    });
    console.log('OTP email sent to:', email);
  } catch (error) {
    console.error('OTP email failed:', {
      code: error.code,
      response: error.response,
      message: error.message,
    });
    throw error;
  }
}

module.exports = {
  sendOtpEmail,
};
