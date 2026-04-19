const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { sendOtpEmail } = require('../config/mailer');

const CUET_EMAIL_REGEX = /^u\d{7}@student\.cuet\.ac\.bd$/;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateCuetEmail(email) {
  return CUET_EMAIL_REGEX.test(email);
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildTokenPayload(user) {
  return {
    userId: user._id,
    email: user.email,
    name: user.name,
  };
}

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw createHttpError(500, 'JWT_SECRET is not configured in environment variables.');
  }

  return jwt.sign(buildTokenPayload(user), process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

async function register(req, res) {
  const { name, email, password, department, batch } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const cleanedName = String(name || '').trim();
  const cleanedDepartment = String(department || '').trim();
  const cleanedBatch = String(batch || '').trim();

  if (!cleanedName || !normalizedEmail || !password) {
    throw createHttpError(400, 'Name, email, and password are required.');
  }

  if (!validateCuetEmail(normalizedEmail)) {
    throw createHttpError(400, "Invalid email format. Use: uXXXXXXX@student.cuet.ac.bd");
  }

  if (String(password).length < 6) {
    throw createHttpError(400, 'Password must be at least 6 characters long.');
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw createHttpError(409, 'Email is already registered.');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const otp = generateOtp();

  const user = await User.create({
    name: cleanedName,
    email: normalizedEmail,
    password: hashedPassword,
    department: cleanedDepartment,
    batch: cleanedBatch,
    isVerified: false,
    otp,
  });

  try {
    await sendOtpEmail(user.email, otp, user.name);
  } catch (emailError) {
    await User.deleteOne({ _id: user._id });
    throw createHttpError(500, 'Failed to send OTP email. Please try again later.');
  }

  return res.status(201).json({
    success: true,
    message: 'Registration successful. OTP sent to your email.',
  });
}

async function verifyOtp(req, res) {
  const { email, otp } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp) {
    throw createHttpError(400, 'Email and OTP are required.');
  }

  if (!validateCuetEmail(normalizedEmail)) {
    throw createHttpError(400, "Invalid email format. Use: uXXXXXXX@student.cuet.ac.bd");
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw createHttpError(404, 'User not found.');
  }

  if (user.isVerified) {
    throw createHttpError(400, 'Email is already verified.');
  }

  if (user.otp !== String(otp).trim()) {
    throw createHttpError(400, 'Invalid OTP.');
  }

  user.isVerified = true;
  user.otp = null;
  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Email verified successfully.',
  });
}

async function resendOtp(req, res) {
  const { email } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw createHttpError(400, 'Email is required.');
  }

  if (!validateCuetEmail(normalizedEmail)) {
    throw createHttpError(400, "Invalid email format. Use: uXXXXXXX@student.cuet.ac.bd");
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw createHttpError(404, 'User not found.');
  }

  if (user.isVerified) {
    throw createHttpError(400, 'Email is already verified.');
  }

  const otp = generateOtp();
  user.otp = otp;
  await user.save();

  await sendOtpEmail(user.email, otp, user.name);

  return res.status(200).json({
    success: true,
    message: 'A new OTP has been sent to your email.',
  });
}

async function login(req, res) {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw createHttpError(400, 'Email and password are required.');
  }

  if (!validateCuetEmail(normalizedEmail)) {
    throw createHttpError(400, "Invalid email format. Use: uXXXXXXX@student.cuet.ac.bd");
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw createHttpError(401, 'Invalid email or password.');
  }

  if (!user.isVerified) {
    throw createHttpError(403, 'Please verify your email before logging in.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw createHttpError(401, 'Invalid email or password.');
  }

  const token = signToken(user);

  return res.status(200).json({
    success: true,
    message: 'Login successful.',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      department: user.department || '',
      batch: user.batch || '',
      isVerified: user.isVerified,
    },
  });
}

async function getMe(req, res) {
  const user = await User.findById(req.user.userId).select('-password -otp');

  if (!user) {
    throw createHttpError(404, 'User not found.');
  }

  return res.status(200).json({
    success: true,
    user,
  });
}

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  getMe,
};
