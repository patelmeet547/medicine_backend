const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

console.log('🚀 Starting server...');

// Load environment variables
try {
  require('dotenv').config();
  console.log('✅ dotenv loaded');
} catch (e) {
  console.log('⚠️ dotenv not found, using environment variables');
}

console.log('📝 Environment variables loaded:', {
  MONGODB_URI: process.env.MONGODB_URI ? 'set' : 'not set',
  MONGO_URI: process.env.MONGO_URI ? 'set' : 'not set',
  VERCEL: process.env.VERCEL ? 'yes' : 'no'
});

// Import medicine routes first!
const medicineRoutes = require('./routes/medicine.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Medicine Management Backend API is running!',
    mongoConnected: mongoose.connection.readyState === 1,
    env: {
      VERCEL: process.env.VERCEL,
      NODE_ENV: process.env.NODE_ENV
    }
  });
});

// Routes
app.use('/api/medicines', medicineRoutes);

// Config endpoint for frontend
app.get('/api/config', (req, res) => {
  res.json({
    whatsappNumber: process.env.WHATSAPP_NUMBER || '919023178824'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// MongoDB Connection with better error handling
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (mongoURI) {
  console.log('🔗 Connecting to MongoDB...');
  mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000
  })
    .then(() => console.log('✅ MongoDB Connected'))
    .catch((err) => {
      console.error('❌ MongoDB Connection Error:', err.message);
      console.error('❌ Full error:', err);
    });
} else {
  console.log('⚠️ No MongoDB URI provided, database will not be connected');
}

const PORT = process.env.PORT || 5000;

// For local development only
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

// Export for Vercel serverless
module.exports = app;
