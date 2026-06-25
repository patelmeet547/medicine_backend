const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const Medicine = require('../models/Medicine');
const path    = require('path');
const fs      = require('fs');

// Make sure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('✅ Uploads directory created');
  } catch (err) {
    console.error('❌ Failed to create uploads directory:', err);
  }
}

// Log all medicine requests
router.use((req, res, next) => {
  console.log(`[MEDICINE ROUTE] ${req.method} ${req.url}`);
  next();
});

// GET all medicines (with optional filters)
router.get('/', async (req, res) => {
  console.log('📥 GET /medicines (or /api/medicines) called');
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
    console.log('🔍 Query filter:', filter);
    const medicines = await Medicine.find(filter).sort({ createdAt: -1 });
    console.log('📤 Found', medicines.length, 'medicines');
    res.json({ success: true, data: medicines });
  } catch (err) {
    console.error('❌ Error in GET /medicines:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all unique categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await Medicine.distinct('category');
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single medicine by ID
router.get('/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found' });
    res.json({ success: true, data: medicine });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create medicine (supports multiple images - max 10)
router.post('/', upload.array('images', 10), async (req, res) => {
  try {
    const { name, category, drugType, description, manufacturer, sideEffects, inStock } = req.body;
    
    // Handle multiple images
    const imageUrls = req.files && req.files.length > 0 
      ? req.files.map(file => `/uploads/${file.filename}`) 
      : [];
    
    // For backward compatibility, set the first image as the main image
    const mainImage = imageUrls.length > 0 ? imageUrls[0] : '';
    
    const medicine = new Medicine({
      name, 
      category, 
      drugType: drugType || '',
      description, 
      manufacturer,
      sideEffects: sideEffects || '',
      inStock: inStock === 'true' || inStock === true,
      image: mainImage,
      images: imageUrls,
    });
    await medicine.save();
    res.status(201).json({ success: true, data: medicine });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT update medicine (supports multiple images - max 10)
router.put('/:id', upload.array('images', 10), async (req, res) => {
  try {
    const existing = await Medicine.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Medicine not found' });
    
    const { name, category, drugType, description, manufacturer, sideEffects, inStock, keepImages } = req.body;
    
    // Parse keepImages if it's a JSON string
    let keptImages = [];
    try {
      keptImages = keepImages ? JSON.parse(keepImages) : [];
    } catch {
      keptImages = [];
    }
    
    // Get new uploaded images
    const newImageUrls = req.files && req.files.length > 0 
      ? req.files.map(file => `/uploads/${file.filename}`) 
      : [];
    
    // Combine kept existing images with new images
    const allImages = [...keptImages, ...newImageUrls].slice(0, 10);
    
    // Delete images that are no longer needed
    if (existing.images && existing.images.length > 0) {
      existing.images.forEach(imgUrl => {
        if (!allImages.includes(imgUrl)) {
          const oldPath = path.join(__dirname, '..', imgUrl);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
      });
    }
    
    // For backward compatibility, set the first image as the main image
    const mainImage = allImages.length > 0 ? allImages[0] : '';
    
    const updated = await Medicine.findByIdAndUpdate(
      req.params.id,
      { 
        name, 
        category, 
        drugType: drugType || '', 
        description, 
        manufacturer, 
        sideEffects: sideEffects || '',
        inStock: inStock === 'true' || inStock === true, 
        image: mainImage,
        images: allImages
      },
      { new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE bulk medicines
router.delete('/bulk/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ success: false, message: 'No IDs provided' });
    const meds = await Medicine.find({ _id: { $in: ids } });
    meds.forEach((med) => {
      // Delete all images
      if (med.images && med.images.length > 0) {
        med.images.forEach(imgUrl => {
          const imgPath = path.join(__dirname, '..', imgUrl);
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        });
      } else if (med.image) {
        const imgPath = path.join(__dirname, '..', med.image);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }
    });
    await Medicine.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `${ids.length} medicines deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE single medicine
router.delete('/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found' });
    
    // Delete all images
    if (medicine.images && medicine.images.length > 0) {
      medicine.images.forEach(imgUrl => {
        const imgPath = path.join(__dirname, '..', imgUrl);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      });
    } else if (medicine.image) {
      const imgPath = path.join(__dirname, '..', medicine.image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    
    await Medicine.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Medicine deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
