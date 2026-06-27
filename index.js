const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Load environment variables if available
try { require('dotenv').config(); } catch (e) { /* ignore */ }

const app = express();

// 1. Super permissive CORS
app.use(cors({ origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 2. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB Atlas');
}).catch((err) => {
  console.error('❌ Failed to connect to MongoDB', err);
});

// 3. Routes
app.get('/', (req, res) => {
  res.send(`
    <h1>✅ Backend LIVE! (MongoDB Connected)</h1>
    <h2>Try these:</h2>
    <ul>
      <li><a href="/test">/test</a></li>
      <li><a href="/api/medicines">/api/medicines</a></li>
      <li><a href="/api/medicines/meta/categories">/api/medicines/meta/categories</a></li>
      <li><a href="/api/config">/api/config</a></li>
    </ul>
  `);
});

app.get('/test', (req, res) => {
  res.json({ success: true, message: '🎉 Test route works perfectly!' });
});

app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    whatsappNumber: process.env.WHATSAPP_NUMBER || '919023178824',
    usingInMemoryStorage: false
  });
});

// API Routes
app.use('/api/medicines', require('./routes/medicine.routes'));

// Also support /medicines without /api prefix
app.use('/medicines', (req, res, next) => {
  req.url = '/api/medicines' + req.url;
  app.handle(req, res, next);
});

// Listen locally if not on Vercel
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log('🚀 Backend listening on port', PORT));
}

module.exports = app;
