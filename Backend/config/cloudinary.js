const cloudinaryLib = require('cloudinary');
const cloudinary = cloudinaryLib.v2;
const multer = require('multer');
const multerStorageCloudinary = require('multer-storage-cloudinary');

// Configure Cloudinary using environment variables from your .env file.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// so pass the full cloudinary package object here.
const storage = multerStorageCloudinary({
  cloudinary: cloudinaryLib,
  folder: (req, file, cb) => cb(null, 'echoes_of_cuet'),
  allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  filename: (req, file, cb) => cb(null, `memory-${Date.now()}`),
});

// Export the multer middleware directly.
// Usage in routes: const upload = require('../config/cloudinary');
module.exports = multer({ storage });
