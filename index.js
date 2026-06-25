const express = require('express');
const cors = require('cors');

// Load environment variables if available
try { require('dotenv').config(); } catch (e) { /* ignore */ }

const app = express();

// 1. Super permissive CORS
app.use(cors({ origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. In-memory storage (for immediate testing, NO DB needed!)
let medicines = [];
let nextId = 1;

// 3. Routes
app.get('/', (req, res) => {
  res.send(`
    <h1>✅ Backend LIVE!</h1>
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
    usingInMemoryStorage: true
  });
});

// GET all medicines
app.get('/api/medicines', async (req, res) => {
  try {
    const result = medicines.slice().reverse(); // newest first
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET categories
app.get('/api/medicines/meta/categories', async (req, res) => {
  try {
    const categories = [...new Set(medicines.map(m => m.category))];
    res.json({ success: true, data: categories });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST medicine
app.post('/api/medicines', (req, res) => {
  try {
    const medicine = {
      _id: nextId++,
      name: req.body.name,
      category: req.body.category,
      drugType: req.body.drugType || '',
      description: req.body.description,
      manufacturer: req.body.manufacturer,
      sideEffects: req.body.sideEffects || '',
      inStock: req.body.inStock === 'true',
      image: '',
      images: [],
      createdAt: new Date()
    };
    medicines.push(medicine);
    res.status(201).json({ success: true, data: medicine });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

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
