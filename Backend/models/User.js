const mongoose = require('mongoose');

const CUET_EMAIL_REGEX = /^u\d{7}@student\.cuet\.ac\.bd$/;
const ADMIN_EMAIL = 'admin@cuet.ac.bd';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => CUET_EMAIL_REGEX.test(value) || value === ADMIN_EMAIL,
        message: 'Invalid email format.',
      },
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    batch: {
      type: String,
      trim: true,
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300,
    },
    profileImage: {
      type: String,
      trim: true,
      default: '',
    },
    coverImage: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
