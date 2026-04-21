const mongoose = require('mongoose');

// This schema defines what a "memory" document looks like in MongoDB.
// Each field here becomes a property inside the memory collection.
const memorySchema = new mongoose.Schema(
  {
    // Short heading for the memory.
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Longer explanation/story of the memory.
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Category helps group memories (example: "academic", "sports", "hostel").
    category: {
      type: String,
      default: 'general',
      trim: true,
    },

    // Latitude and longitude where the memory happened.
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },

    // Cloudinary URL for the uploaded image.
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },

    // Reference to the user who shared the memory.
    // Keep it optional if you are not yet attaching auth middleware.
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    // Frontend profile snapshot fields used for rendering cards and markers.
    userId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    userName: {
      type: String,
      trim: true,
      default: 'CUET User',
    },
    userProfileImage: {
      type: String,
      trim: true,
      default: '',
    },

    // Moderation workflow status.
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },

    // Moderation action timestamps.
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    lastEditedAt: {
      type: Date,
      default: null,
    },

    // Stores optional reason when a memory is rejected.
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },

    // Audit trail for moderation actions.
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          required: true,
        },
        action: {
          type: String,
          enum: ['submitted', 'edited', 'approved', 'rejected'],
          required: true,
        },
        note: {
          type: String,
          trim: true,
          default: '',
        },
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Engagement interactions.
    likes: [
      {
        userId: {
          type: String,
          required: true,
          trim: true,
        },
        userName: {
          type: String,
          trim: true,
          default: 'CUET User',
        },
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    comments: [
      {
        userId: {
          type: String,
          required: true,
          trim: true,
        },
        userName: {
          type: String,
          trim: true,
          default: 'CUET User',
        },
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: 500,
        },
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    shares: [
      {
        userId: {
          type: String,
          required: true,
          trim: true,
        },
        userName: {
          type: String,
          trim: true,
          default: 'CUET User',
        },
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reports: [
      {
        userId: {
          type: String,
          required: true,
          trim: true,
        },
        userName: {
          type: String,
          trim: true,
          default: 'CUET User',
        },
        reason: {
          type: String,
          trim: true,
          default: 'No reason provided',
          maxlength: 500,
        },
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    // Automatically adds createdAt and updatedAt fields.
    timestamps: true,
  }
);

module.exports = mongoose.model('Memory', memorySchema);
