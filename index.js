const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Load environment variables if available
try { require('dotenv').config(); } catch (e) { /* ignore */ }

const app = express();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for in-memory upload (for Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// 1. Super permissive CORS
app.use(cors({ origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Import Medicine model
const Medicine = require('./models/Medicine');

// 3. Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb+srv://mvasoya829_db_user:Bhuri123456@medicine.224a9s8.mongodb.net/medicine_db?retryWrites=true&w=majority&appName=medicine";

mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// 4. Helper function to upload to Cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'medicines' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
};

// 5. Routes
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
    usingMongoDB: true
  });
});

// GET all medicines
app.get('/api/medicines', async (req, res) => {
  try {
    const { category, inStock, search } = req.query;
    const filter = {};
    if (category && category !== 'All') filter.category = category;
    if (inStock !== undefined && inStock !== '') filter.inStock = inStock === 'true';
    if (search) filter.$or = [
      { name:         { $regex: search, $options: 'i' } },
      { description:  { $regex: search, $options: 'i' } },
      { drugType:     { $regex: search, $options: 'i' } },
      { manufacturer: { $regex: search, $options: 'i' } },
      { category:     { $regex: search, $options: 'i' } },
    ];
    const medicines = await Medicine.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: medicines });
  } catch (err) {
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

// GET single medicine by ID
app.get('/api/medicines/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found' });
    res.json({ success: true, data: medicine });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST medicine (with Cloudinary image upload)
app.post('/api/medicines', upload.array('images', 10), async (req, res) => {
  try {
    const data = req.body;
    let imageUrls = [];

    if (req.files && req.files.length > 0) {
      imageUrls = await Promise.all(
        req.files.map(file => uploadToCloudinary(file.buffer))
      );
    }

    const medicine = new Medicine({
      name: data.name,
      category: data.category,
      drugType: data.drugType || '',
      description: data.description,
      manufacturer: data.manufacturer,
      sideEffects: data.sideEffects || '',
      inStock: data.inStock === 'true' || data.inStock === true,
      image: imageUrls[0] || '',
      images: imageUrls
    });

    await medicine.save();
    res.status(201).json({ success: true, data: medicine });
  } catch (err) {
    console.error('Error creating medicine:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT (update) medicine
app.put('/api/medicines/:id', upload.array('images', 10), async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found' });

    const data = req.body;
    let imageUrls = medicine.images || [];

    // If user provided existing images to keep
    if (data.keepImages) {
      try {
        imageUrls = JSON.parse(data.keepImages);
      } catch (e) { /* ignore */ }
    }

    // If user uploaded new images
    if (req.files && req.files.length > 0) {
      const newImages = await Promise.all(
        req.files.map(file => uploadToCloudinary(file.buffer))
      );
      imageUrls = [...imageUrls, ...newImages].slice(0, 10);
    }

    // Update medicine
    medicine.name = data.name;
    medicine.category = data.category;
    medicine.drugType = data.drugType || '';
    medicine.description = data.description;
    medicine.manufacturer = data.manufacturer;
    medicine.sideEffects = data.sideEffects || '';
    medicine.inStock = data.inStock === 'true' || data.inStock === true;
    medicine.image = imageUrls[0] || '';
    medicine.images = imageUrls;

    await medicine.save();
    res.json({ success: true, data: medicine });
  } catch (err) {
    console.error('Error updating medicine:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE single medicine
app.delete('/api/medicines/:id', async (req, res) => {
  try {
    await Medicine.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Medicine deleted successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE bulk medicines
app.delete('/api/medicines/bulk/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ success: false, message: 'Invalid request' });

    await Medicine.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `${ids.length} medicines deleted successfully` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
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
