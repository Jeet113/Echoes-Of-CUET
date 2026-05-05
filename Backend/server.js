const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

// require('dotenv').config({ path: path.join(__dirname, '.env') });
// require('dotenv').config({ path: './Backend/.env' });
require('dotenv').config();

const memoryRoutes = require('./routes/memoryRoutes');
const authRoutes = require('./routes/authRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Middleware
// Allows frontend requests from other origins (like localhost:5500 -> localhost:5000).
app.use(cors());

// Parses incoming JSON request bodies.
app.use(express.json());

// Parses URL-encoded data (useful for simple form posts).
app.use(express.urlencoded({ extended: true }));

// Simple test route to check if server is running.
app.get('/', (req, res) => {
  res.send('Echoes-Of-CUET backend is running.');
});

// Mount memory routes under /api/memories.
app.use('/api/memories', memoryRoutes);
app.use('/api/auth', authRoutes);

// Fallback + centralized error handlers.
app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB Atlas and then start the server.
async function startServer() {
  try {
    const emailEnvStatus = {
      EMAIL_HOST: Boolean(process.env.EMAIL_HOST),
      EMAIL_PORT: Boolean(process.env.EMAIL_PORT),
      EMAIL_USER: Boolean(process.env.EMAIL_USER),
      EMAIL_PASS: Boolean(process.env.EMAIL_PASS),
      EMAIL_FROM: Boolean(process.env.EMAIL_FROM),
    };
    console.log('Email env present:', emailEnvStatus);

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

startServer();
