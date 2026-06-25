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

// CORS Middleware (very permissive)
app.use(cors({
  origin: true, // Allow any origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Parse requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Log all requests
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Test routes
app.get('/', (req, res) => {
  res.send('Medicine Backend is LIVE! 🚀<br><br>Try:<br><a href="/test">/test</a><br><a href="/api/medicines">/api/medicines</a><br><a href="/medicines">/medicines</a><br><a href="/api/config">/api/config</a>');
});

app.get('/test', (req, res) => {
  res.json({ success: true, message: 'Test route works! 🎉' });
});

// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    success: true, whatsappNumber: process.env.WHATSAPP_NUMBER || '919023178824'
  });
});

// Medicine Routes (both prefixes)
app.use('/api/medicines', medicineRoutes);
app.use('/medicines', medicineRoutes);

// Catch-all debug route
app.all('*', (req, res) => {
  console.log(`Catch-all hit for: [${req.method}] ${req.url}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    availableRoutes: ['/', '/test', '/api/config', '/api/medicines', '/medicines']
  });
});

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
