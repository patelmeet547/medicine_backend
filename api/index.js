const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Load environment variables if available
try { require('dotenv').config(); } catch (e) { console.log('dotenv not found'); }

const app = express();

// 1. CORS - very permissive
app.use(cors({ origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Make uploads setup
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) { try { fs.mkdirSync(uploadDir, { recursive: true }); console.log('Uploads dir created'); } catch (e) { console.error('Uploads dir error:', e); } }
app.use('/uploads', express.static(uploadDir));

// 3. Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// 4. Medicine Schema
const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  drugType: { type: String, default: '' },
  description: { type: String, required: true },
  manufacturer: { type: String, required: true },
  sideEffects: { type: String, default: '' },
  inStock: { type: Boolean, default: true },
  image: { type: String, default: '' },
  images: [{ type: String, default: '' }]
}, { timestamps: true });

const Medicine = mongoose.model('Medicine', medicineSchema);

// 5. Routes
app.get('/', (req, res) => { res.send('Backend LIVE! 🚀<br>Try:<br><a href=\"/test\">/test</a><br><a href=\"/api/medicines\">/api/medicines</a>'); });
app.get('/test', (req, res) => res.json({ success: true, message: 'Test works!' }));
app.get('/api/config', (req, res) => res.json({ success: true, whatsappNumber: process.env.WHATSAPP_NUMBER || '919023178824' }));

// GET all medicines
app.get('/api/medicines', async (req, res) => {
  console.log('📥 GET /api/medicines');
  try {
    const medicines = await Medicine.find().sort({ createdAt: -1 });
    console.log('📤 Found', medicines.length, 'meds');
    res.json({ success: true, data: medicines });
  } catch (err) {
    console.error('❌ GET error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET categories
app.get('/api/medicines/meta/categories', async (req, res) => {
  try {
    const categories = await Medicine.distinct('category');
    res.json({ success: true, data: categories });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST medicine
app.post('/api/medicines', upload.array('images', 10), async (req, res) => {
  try {
    const imageUrls = req.files ? req.files.map(file => '/uploads/' + file.filename) : [];
    const medicine = new Medicine({
      name: req.body.name,
      category: req.body.category,
      drugType: req.body.drugType || '',
      description: req.body.description,
      manufacturer: req.body.manufacturer,
      sideEffects: req.body.sideEffects || '',
      inStock: req.body.inStock === 'true',
      image: imageUrls[0] || '',
      images: imageUrls
    });
    await medicine.save();
    res.status(201).json({ success: true, data: medicine });
  } catch (err) {
    console.error('❌ POST error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Also support without /api prefix (for compatibility)
app.use('/medicines', (req, res, next) => {
  req.url = '/api/medicines' + req.url;
  app.handle(req, res, next);
});

// 6. MongoDB
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (mongoURI) {
  mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err.message));
} else {
  console.log('⚠️ No MongoDB URI');
}

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Listening on', PORT));
}

module.exports = app;
