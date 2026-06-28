const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
let cloudinary;
try {
  cloudinary = require('cloudinary').v2;
} catch (e) {
  console.log('Cloudinary not found');
}

// Load environment variables
try { require('dotenv').config(); } catch (e) { /* ignore */ }

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure Cloudinary if available
if (cloudinary) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('✅ Cloudinary configured');
  } catch (e) {
    console.log('⚠️ Cloudinary config failed:', e.message);
  }
}

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Import Medicine model
let Medicine;
try {
  Medicine = require('./models/Medicine');
} catch (e) {
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

// Import Models
const Order = require('./models/Order');
const Admin = require('./models/Admin');

// In-memory fallback if MongoDB fails
let inMemoryMedicines = [];
let inMemoryOrders = [];
let useInMemory = false;

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb+srv://mvasoya829_db_user:Bhuri12345@medicine.224a9s8.mongodb.net/medicine_db?retryWrites=true&w=majority&appName=medicine";
mongoose.connect(mongoURI)
  .then(async () => {
    console.log('✅ MongoDB Connected');
    useInMemory = false;
    
    // Seed default Admin if none exists
    try {
      const adminExists = await Admin.findOne({ email: 'admin@gmail.com' });
      if (!adminExists) {
        await Admin.create({ email: 'admin@gmail.com', password: 'Admin@12123' });
        console.log('✅ Default Admin seeded in MongoDB');
      }
    } catch (e) {
      console.log('⚠️ Could not seed admin:', e.message);
    }
  })
  .catch((err) => {
    console.log('⚠️ MongoDB failed, using in-memory:', err.message);
    useInMemory = true;
  });

// Helper to upload to Cloudinary
const uploadToCloudinary = async (buffer) => {
  if (!cloudinary) return null;
  try {
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
  } catch (e) {
    console.log('⚠️ Cloudinary upload failed:', e.message);
    return null;
  }
};

// Test routes
app.get('/', (req, res) => {
  res.send(`<h1>✅ Backend LIVE!</h1><p>Using: ${useInMemory ? 'In-Memory Storage' : 'MongoDB'}</p>`);
});
app.get('/test', (req, res) => res.json({ success: true, message: 'Works!' }));
app.get('/api/config', (req, res) => res.json({
  success: true,
  usingMongoDB: !useInMemory,
  usingCloudinary: !!cloudinary,
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
      const searchRegex = filter.$or[0].name.$regex.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(searchRegex) ||
        m.description.toLowerCase().includes(searchRegex) ||
        m.manufacturer.toLowerCase().includes(searchRegex)
      );
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
    let imageUrls = [];
    let mainImage = '';

    // Upload images to Cloudinary if available
    if (req.files && req.files.length > 0) {
      imageUrls = await Promise.all(
        req.files.map(async (file) => {
          const url = await uploadToCloudinary(file.buffer);
          return url || '';
        })
      ).catch(() => []);
      mainImage = imageUrls[0] || '';
    }

    const medicineData = {
      name: data.name,
      category: data.category,
      drugType: data.drugType || '',
      description: data.description,
      manufacturer: data.manufacturer,
      sideEffects: data.sideEffects || '',
      inStock: data.inStock === 'true' || data.inStock === true,
      image: mainImage,
      images: imageUrls
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
    let existingImages = [];

    // Parse existing images from request
    if (data.keepImages) {
      try {
        existingImages = JSON.parse(data.keepImages);
      } catch (e) {
        existingImages = [];
      }
    }

    // Upload new images to Cloudinary
    let newImages = [];
    if (req.files && req.files.length > 0) {
      newImages = await Promise.all(
        req.files.map(async (file) => {
          const url = await uploadToCloudinary(file.buffer);
          return url || '';
        })
      ).catch(() => []);
    }

    const allImages = [...existingImages, ...newImages].slice(0, 10);
    const mainImage = allImages[0] || '';

    if (useInMemory) {
      const index = inMemoryMedicines.findIndex(m => m._id == req.params.id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      inMemoryMedicines[index] = {
        ...inMemoryMedicines[index],
        ...data,
        image: mainImage,
        images: allImages,
        _id: req.params.id
      };
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
        inStock: data.inStock === 'true' || data.inStock === true,
        image: mainImage,
        images: allImages
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

// Create an order
app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, customerPhone, items } = req.body;
    if (useInMemory) {
      const newOrder = {
        _id: Date.now().toString(),
        customerName,
        customerPhone,
        items,
        status: 'Pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryOrders.push(newOrder);
      return res.status(201).json({ success: true, data: newOrder });
    } else {
      const order = new Order({ customerName, customerPhone, items });
      await order.save();
      return res.status(201).json({ success: true, data: order });
    }
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get all orders (for admin)
app.get('/api/orders', async (req, res) => {
  try {
    if (useInMemory) {
      return res.json({ success: true, data: inMemoryOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
    } else {
      const orders = await Order.find().sort({ createdAt: -1 });
      return res.json({ success: true, data: orders });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update order status
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (useInMemory) {
      const order = inMemoryOrders.find(o => o._id === req.params.id);
      if (!order) return res.status(404).json({ success: false, message: 'Not found' });
      order.status = status;
      order.updatedAt = new Date();
      return res.json({ success: true, data: order });
    } else {
      const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
      if (!order) return res.status(404).json({ success: false, message: 'Not found' });
      return res.json({ success: true, data: order });
    }
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Admin Login Route
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
  
  if (useInMemory) {
    if (email === 'admin@gmail.com' && password === 'Admin@12123') {
      return res.json({ success: true, message: 'Login successful' });
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    
    // Using plain text comparison
    if (admin.password !== password) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    
    res.json({ success: true, message: 'Login successful' });
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
