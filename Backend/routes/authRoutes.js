const express = require('express');

const authController = require('../controllers/authController');
const asyncHandler = require('../middleware/asyncHandler');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', asyncHandler(authController.register));
router.post('/verify-otp', asyncHandler(authController.verifyOtp));
router.post('/resend-otp', asyncHandler(authController.resendOtp));
router.post('/login', asyncHandler(authController.login));
router.put('/profile', protect, asyncHandler(authController.updateProfile));
router.get('/me', protect, asyncHandler(authController.getMe));
router.get('/admin/users', protect, asyncHandler(authController.getAdminUsers));

module.exports = router;
