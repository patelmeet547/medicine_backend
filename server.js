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

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root route
app.get('/', (req, res) => {
  res.send('Medicine Backend is LIVE! 🚀');
});

// Medicine Schema
const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  drugType: { type: String, default: '', trim: true },
  description: { type: String, required: true },
  manufacturer: { type: String, required: true },
  sideEffects: { type: String, default: '' },
  inStock: { type: Boolean, default: true },
  image: { type: String, default: '' },
  images: [{ type: String, default: '' }]
}, { timestamps: true });

const Medicine = mongoose.model('Medicine', medicineSchema);

// Medicine Routes
app.get('/api/medicines', async (req, res) => {
  try {
    const { category, inStock, search } = req.query;
    const filter = {};
    
    if (category && category !== 'All') {
      filter.category = category;
    }
    
    if (inStock !== undefined && inStock !== '') {
      filter.inStock = inStock === 'true';
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { drugType: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    
    const medicines = await Medicine.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: medicines });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/medicines/meta/categories', async (req, res) => {
  try {
    const categories = await Medicine.distinct('category');
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/medicines/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.json({ success: true, data: medicine });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/medicines', async (req, res) => {
  try {
    const medicine = new Medicine(req.body);
    await medicine.save();
    res.status(201).json({ success: true, data: medicine });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/medicines/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.json({ success: true, data: medicine });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/medicines/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndDelete(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.json({ success: true, message: 'Medicine deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/medicines/bulk/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No IDs provided' });
    }
    await Medicine.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `${ids.length} medicines deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    whatsappNumber: process.env.WHATSAPP_NUMBER || '919023178824'
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