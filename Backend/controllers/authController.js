const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Memory = require('../models/Memory');
const { sendOtpEmail } = require('../config/mailer');

const CUET_EMAIL_REGEX = /^u\d{7}@student\.cuet\.ac\.bd$/;
const ADMIN_EMAIL = 'admin@cuet.ac.bd';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

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

function validateLoginEmail(email) {
  return validateCuetEmail(email) || email === ADMIN_EMAIL;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildTokenPayload(user) {
  return {
    userId: user._id,
    email: user.email,
    name: user.name,
    role: user.role || 'user',
  };
}

async function ensureAdminAccount() {
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      existing.isVerified = true;
      existing.otp = null;
      await existing.save();
    }
    return existing;
  }

  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD, 12);

  const admin = await User.create({
    name: 'CUET Admin',
    email: ADMIN_EMAIL,
    password: hashedPassword,
    role: 'admin',
    isVerified: true,
    otp: null,
    department: 'Administration',
    batch: '',
  });

  return admin;
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

  if (normalizedEmail === ADMIN_EMAIL) {
    throw createHttpError(400, 'This email is reserved for admin login.');
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

  if (!validateLoginEmail(normalizedEmail)) {
    throw createHttpError(400, "Invalid email format. Use: uXXXXXXX@student.cuet.ac.bd or admin@cuet.ac.bd");
  }

  if (normalizedEmail === ADMIN_EMAIL) {
    await ensureAdminAccount();
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
      bio: user.bio || '',
      profileImage: user.profileImage || '',
      coverImage: user.coverImage || '',
      role: user.role || 'user',
      isVerified: user.isVerified,
    },
  });
}

async function updateProfile(req, res) {
  const { name, department, batch, bio, profileImage, coverImage } = req.body;

  const user = await User.findById(req.user.userId);
  if (!user) {
    throw createHttpError(404, 'User not found.');
  }

  if (typeof name !== 'undefined') {
    const cleanedName = String(name).trim();
    if (!cleanedName) {
      throw createHttpError(400, 'Name cannot be empty.');
    }
    user.name = cleanedName;
  }

  if (typeof department !== 'undefined') {
    user.department = String(department || '').trim();
  }

  if (typeof batch !== 'undefined') {
    user.batch = String(batch || '').trim();
  }

  if (typeof bio !== 'undefined') {
    user.bio = String(bio || '').trim();
  }

  if (typeof profileImage !== 'undefined') {
    user.profileImage = String(profileImage || '').trim();
  }

  if (typeof coverImage !== 'undefined') {
    user.coverImage = String(coverImage || '').trim();
  }

  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Profile updated successfully.',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      department: user.department || '',
      batch: user.batch || '',
      bio: user.bio || '',
      profileImage: user.profileImage || '',
      coverImage: user.coverImage || '',
      role: user.role || 'user',
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

async function getAdminUsers(req, res) {
  if (!req.user || req.user.role !== 'admin') {
    throw createHttpError(403, 'Admin access required.');
  }

  const users = await User.find().select('-password -otp').sort({ createdAt: -1 });
  const memoryCountsRaw = await Memory.aggregate([
    {
      $group: {
        _id: '$userId',
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map(memoryCountsRaw.map((item) => [String(item._id || ''), item.count]));

  const list = users.map((user) => {
    const id = String(user._id);
    const memoryCount = countMap.get(id) || 0;

    return {
      id,
      name: user.name,
      email: user.email,
      department: user.department || '',
      batch: user.batch || '',
      role: user.role || 'user',
      isVerified: !!user.isVerified,
      createdAt: user.createdAt,
      memoryCount,
    };
  });

  return res.status(200).json({
    success: true,
    users: list,
  });
}

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  updateProfile,
  getMe,
  getAdminUsers,
};
