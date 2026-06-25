const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Load environment variables if available
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not found');
}

const medicineRoutes = require('../routes/medicine.routes');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root route
app.get('/', (req, res) => {
  res.send('Medicine Backend is LIVE! 🚀');
});

// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    whatsappNumber: process.env.WHATSAPP_NUMBER || '919023178824'
  });
});

// Medicine Routes
app.use('/api/medicines', medicineRoutes);

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (mongoURI) {
  mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch((err) => console.error('❌ MongoDB Error:', err.message));
} else {
  console.log('⚠️ MongoDB URI not provided');
}

// Don't listen in serverless environment
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;
