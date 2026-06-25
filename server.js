const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Load environment variables
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not found, using environment variables');
}

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
    mongoConnected: mongoose.connection.readyState === 1 
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

// MongoDB Connection with better error handling
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (mongoURI) {
  mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch((err) => console.error('❌ MongoDB Connection Error:', err.message));
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
