const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const Medicine = require('../models/Medicine');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to upload buffer to Cloudinary
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
    
    // Handle multiple images to Cloudinary
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
      imageUrls = await Promise.all(uploadPromises);
    }
    
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
    
    // Get new uploaded images to Cloudinary
    let newImageUrls = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
      newImageUrls = await Promise.all(uploadPromises);
    }
    
    // Combine kept existing images with new images
    const allImages = [...keptImages, ...newImageUrls].slice(0, 10);
    
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
    
    // Note: To fully clean up, you should also delete images from Cloudinary here
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
    
    // Note: To fully clean up, you should also delete images from Cloudinary here
    await Medicine.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Medicine deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
