const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');

// Load environment variables
try { require('dotenv').config(); } catch (e) { /* ignore */ }

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Import Medicine model
let Medicine;
try {
  Medicine = require('./models/Medicine');
} catch (e) {
  // Fallback if model fails
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
  try {
    Medicine = mongoose.model('Medicine');
  } catch {
    Medicine = mongoose.model('Medicine', medicineSchema);
  }
}

// In-memory fallback if MongoDB fails
let inMemoryMedicines = [];
let useInMemory = false;

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb+srv://mvasoya829_db_user:Bhuri123456@medicine.224a9s8.mongodb.net/medicine_db?retryWrites=true&w=majority&appName=medicine";
mongoose.connect(mongoURI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    useInMemory = false;
  })
  .catch((err) => {
    console.log('⚠️ MongoDB failed, using in-memory:', err.message);
    useInMemory = true;
  });

// Test routes
app.get('/', (req, res) => {
  res.send(`<h1>✅ Backend LIVE!</h1><p>Using: ${useInMemory ? 'In-Memory Storage' : 'MongoDB'}</p>`);
});
app.get('/test', (req, res) => res.json({ success: true, message: 'Works!' }));
app.get('/api/config', (req, res) => res.json({
  success: true,
  usingMongoDB: !useInMemory,
  whatsappNumber: process.env.WHATSAPP_NUMBER || '919023178824'
}));

// Helper to get medicines
const getMedicines = async (filter = {}) => {
  if (useInMemory) {
    let result = inMemoryMedicines;
    if (filter.category && filter.category !== 'All') {
      result = result.filter(m => m.category === filter.category);
    }
    if (filter.inStock !== undefined) {
      result = result.filter(m => m.inStock === filter.inStock);
    }
    if (filter.$or) {
      // Simple search for in-memory
      result = result.filter(m => {
        const searchRegex = filter.$or[0].name.$regex;
        const searchOptions = filter.$or[0].name.$options;
        return m.name.toLowerCase().includes(searchRegex.toLowerCase()) ||
               m.description.toLowerCase().includes(searchRegex.toLowerCase()) ||
               m.manufacturer.toLowerCase().includes(searchRegex.toLowerCase());
      });
    }
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return Medicine.find(filter).sort({ createdAt: -1 });
};

// Get all medicines
app.get('/api/medicines', async (req, res) => {
  try {
    const { category, inStock, search } = req.query;
    const filter = {};
    if (category && category !== 'All') filter.category = category;
    if (inStock !== undefined && inStock !== '') filter.inStock = inStock === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } }
      ];
    }
    const medicines = await getMedicines(filter);
    res.json({ success: true, data: medicines });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get categories
app.get('/api/medicines/meta/categories', async (req, res) => {
  try {
    let categories;
    if (useInMemory) {
      categories = [...new Set(inMemoryMedicines.map(m => m.category))];
    } else {
      categories = await Medicine.distinct('category');
    }
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single medicine
app.get('/api/medicines/:id', async (req, res) => {
  try {
    let medicine;
    if (useInMemory) {
      medicine = inMemoryMedicines.find(m => m._id == req.params.id);
    } else {
      medicine = await Medicine.findById(req.params.id);
    }
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, data: medicine });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create medicine
app.post('/api/medicines', upload.array('images', 10), async (req, res) => {
  try {
    const data = req.body;
    const medicineData = {
      name: data.name,
      category: data.category,
      drugType: data.drugType || '',
      description: data.description,
      manufacturer: data.manufacturer,
      sideEffects: data.sideEffects || '',
      inStock: data.inStock === 'true' || data.inStock === true,
      image: '',
      images: []
    };

    if (useInMemory) {
      const newMed = { ...medicineData, _id: Date.now().toString(), createdAt: new Date() };
      inMemoryMedicines.push(newMed);
      res.status(201).json({ success: true, data: newMed });
    } else {
      const medicine = new Medicine(medicineData);
      await medicine.save();
      res.status(201).json({ success: true, data: medicine });
    }
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Update medicine
app.put('/api/medicines/:id', upload.array('images', 10), async (req, res) => {
  try {
    const data = req.body;
    if (useInMemory) {
      const index = inMemoryMedicines.findIndex(m => m._id == req.params.id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      inMemoryMedicines[index] = { ...inMemoryMedicines[index], ...data, _id: req.params.id };
      res.json({ success: true, data: inMemoryMedicines[index] });
    } else {
      const medicine = await Medicine.findById(req.params.id);
      if (!medicine) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      Object.assign(medicine, {
        name: data.name,
        category: data.category,
        drugType: data.drugType || '',
        description: data.description,
        manufacturer: data.manufacturer,
        sideEffects: data.sideEffects || '',
        inStock: data.inStock === 'true' || data.inStock === true
      });
      await medicine.save();
      res.json({ success: true, data: medicine });
    }
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Delete single medicine
app.delete('/api/medicines/:id', async (req, res) => {
  try {
    if (useInMemory) {
      inMemoryMedicines = inMemoryMedicines.filter(m => m._id != req.params.id);
    } else {
      await Medicine.findByIdAndDelete(req.params.id);
    }
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete bulk medicines
app.delete('/api/medicines/bulk/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid' });
    }
    if (useInMemory) {
      inMemoryMedicines = inMemoryMedicines.filter(m => !ids.includes(m._id));
    } else {
      await Medicine.deleteMany({ _id: { $in: ids } });
    }
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Also support /medicines prefix
app.use('/medicines', (req, res, next) => {
  req.url = '/api/medicines' + req.url;
  app.handle(req, res, next);
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => console.log('🚀 Backend running on', PORT));
}

module.exports = app;
