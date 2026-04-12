const express = require('express');
const Memory = require('../models/Memory');
const upload = require('../config/cloudinary');

const router = express.Router();

function parseCoordinates(body) {
  let lat = body.lat;
  let lng = body.lng;

  if ((lat === undefined || lng === undefined) && body.coordinates) {
    let coordinates = body.coordinates;

    if (typeof coordinates === 'string') {
      coordinates = JSON.parse(coordinates);
    }

    lat = coordinates?.lat;
    lng = coordinates?.lng;
  }

  const latNumber = Number(lat);
  const lngNumber = Number(lng);

  return {
    latNumber,
    lngNumber,
  };
}

function addStatusHistory(memory, action, status, note = '') {
  if (!Array.isArray(memory.statusHistory)) {
    memory.statusHistory = [];
  }

  memory.statusHistory.push({
    action,
    status,
    note,
    at: new Date(),
  });
}

async function createMemory(req, res) {
  try {
    const { title, description, category, userId, userName, userProfileImage } = req.body;
    let latNumber;
    let lngNumber;

    try {
      const parsed = parseCoordinates(req.body);
      latNumber = parsed.latNumber;
      lngNumber = parsed.lngNumber;
    } catch (parseError) {
      return res.status(400).json({
        message: 'Invalid coordinates format.',
      });
    }

    // Basic validation with beginner-friendly messages.
    if (!title || !description || !Number.isFinite(latNumber) || !Number.isFinite(lngNumber)) {
      return res.status(400).json({
        message: 'title, description, lat, and lng are required.',
      });
    }

    // Make sure user selected an image.
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required.' });
    }

    // Save the memory in MongoDB.
    // Cloudinary returns the uploaded image URL in req.file.path.
    const imageUrl = req.file.path || req.file.secure_url;

    if (!imageUrl) {
      return res.status(500).json({
        message: 'Image upload URL was not returned by Cloudinary.',
      });
    }

    const memory = await Memory.create({
      title,
      description,
      category: category || 'general',
      imageUrl,
      lat: latNumber,
      lng: lngNumber,
      userId: userId || '',
      userName: userName || 'CUET User',
      userProfileImage: userProfileImage || '',
      status: 'approved',
      submittedAt: new Date(),
      approvedAt: new Date(),
      statusHistory: [
        {
          action: 'submitted',
          status: 'approved',
          at: new Date(),
        },
      ],
    });

    return res.status(201).json({
      message: 'Memory saved successfully.',
      memory,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to save memory.',
      error: error.message,
    });
  }
}

async function getAllMemories(req, res) {
  try {
    // Approval workflow is disabled, so return all memories publicly.
    const memories = await Memory.find().sort({ createdAt: -1 });
    return res.status(200).json(memories);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch memories.',
      error: error.message,
    });
  }
}

async function deleteMemory(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Memory.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Memory not found.' });
    }

    return res.status(200).json({
      message: 'Memory deleted successfully.',
      memoryId: id,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete memory.',
      error: error.message,
    });
  }
}

async function getMemoriesByStatus(req, res) {
  try {
    const { status } = req.params;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const sortField = status === 'approved' ? 'approvedAt' : status === 'rejected' ? 'rejectedAt' : 'submittedAt';
    const memories = await Memory.find({ status }).sort({ [sortField]: -1, createdAt: -1 });

    return res.status(200).json(memories);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch moderation queue.',
      error: error.message,
    });
  }
}

async function getModerationStats(req, res) {
  try {
    const [pending, approved, rejected, total] = await Promise.all([
      Memory.countDocuments({ status: 'pending' }),
      Memory.countDocuments({ status: 'approved' }),
      Memory.countDocuments({ status: 'rejected' }),
      Memory.countDocuments(),
    ]);

    return res.status(200).json({
      pending,
      approved,
      rejected,
      total,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch moderation stats.',
      error: error.message,
    });
  }
}

async function editMemory(req, res) {
  try {
    const { id } = req.params;
    const { title, description, category, lat, lng, imageUrl, note } = req.body;

    const memory = await Memory.findById(id);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found.' });
    }

    if (title !== undefined) memory.title = title;
    if (description !== undefined) memory.description = description;
    if (category !== undefined) memory.category = category;
    if (imageUrl !== undefined) memory.imageUrl = imageUrl;

    if (lat !== undefined || lng !== undefined) {
      const latNumber = Number(lat);
      const lngNumber = Number(lng);

      if (!Number.isFinite(latNumber) || !Number.isFinite(lngNumber)) {
        return res.status(400).json({ message: 'Valid lat and lng are required for location update.' });
      }

      memory.lat = latNumber;
      memory.lng = lngNumber;
    }

    memory.lastEditedAt = new Date();
    addStatusHistory(memory, 'edited', memory.status, note || 'Edited by admin');

    await memory.save();

    return res.status(200).json({
      message: 'Memory updated successfully.',
      memory,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to edit memory.',
      error: error.message,
    });
  }
}

async function approveMemory(req, res) {
  try {
    const { id } = req.params;
    const { title, description, category, lat, lng, imageUrl, note } = req.body;

    const memory = await Memory.findById(id);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found.' });
    }

    // Optional edit before approval.
    if (title !== undefined) memory.title = title;
    if (description !== undefined) memory.description = description;
    if (category !== undefined) memory.category = category;
    if (imageUrl !== undefined) memory.imageUrl = imageUrl;

    if (lat !== undefined || lng !== undefined) {
      const latNumber = Number(lat);
      const lngNumber = Number(lng);

      if (!Number.isFinite(latNumber) || !Number.isFinite(lngNumber)) {
        return res.status(400).json({ message: 'Valid lat and lng are required for location update.' });
      }

      memory.lat = latNumber;
      memory.lng = lngNumber;
    }

    if (title !== undefined || description !== undefined || category !== undefined || lat !== undefined || lng !== undefined || imageUrl !== undefined) {
      memory.lastEditedAt = new Date();
      addStatusHistory(memory, 'edited', memory.status, 'Edited during approval');
    }

    memory.status = 'approved';
    memory.approvedAt = new Date();
    memory.rejectedAt = null;
    memory.rejectionReason = '';
    addStatusHistory(memory, 'approved', 'approved', note || 'Approved by admin');

    await memory.save();

    return res.status(200).json({
      message: 'Memory approved and published.',
      memory,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to approve memory.',
      error: error.message,
    });
  }
}

async function rejectMemory(req, res) {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;

    const memory = await Memory.findById(id);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found.' });
    }

    memory.status = 'rejected';
    memory.rejectedAt = new Date();
    memory.approvedAt = null;
    memory.rejectionReason = reason || '';
    addStatusHistory(memory, 'rejected', 'rejected', note || reason || 'Rejected by admin');

    await memory.save();

    return res.status(200).json({
      message: 'Memory rejected.',
      memory,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to reject memory.',
      error: error.message,
    });
  }
}

async function uploadAsset(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required.' });
    }

    const url = req.file.path || req.file.secure_url;
    if (!url) {
      return res.status(500).json({ message: 'Cloudinary upload URL not found.' });
    }

    return res.status(200).json({
      message: 'Image uploaded successfully.',
      url,
      kind: req.body.kind || 'general',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to upload image.',
      error: error.message,
    });
  }
}

// POST /api/memories/share
// This route receives multipart/form-data from the frontend.
// 1) `upload.single('image')` uploads the image to Cloudinary.
// 2) Then we store text fields + Cloudinary image URL in MongoDB.
router.post('/share', upload.single('image'), createMemory);

// POST /api/memories/upload-image
// Uploads profile/cover images to Cloudinary and returns the URL.
router.post('/upload-image', upload.single('image'), uploadAsset);

// GET /api/memories/all
// Returns only approved memories for public website map.
router.get('/all', getAllMemories);

// Admin moderation endpoints.
// NOTE: In production, protect these with admin authentication middleware.
router.get('/admin/stats', getModerationStats);
router.get('/admin/queue/:status', getMemoriesByStatus);
router.patch('/admin/:id/edit', editMemory);
router.patch('/admin/:id/approve', approveMemory);
router.patch('/admin/:id/reject', rejectMemory);
router.delete('/admin/:id', deleteMemory);

// Optional compatibility aliases:
// Keeping these helps older frontend calls keep working.
router.post('/', upload.single('image'), createMemory);
router.get('/', getAllMemories);

module.exports = router;
