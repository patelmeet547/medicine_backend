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

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Log all medicine requests
router.use((req, res, next) => {
  console.log(`[MEDICINE ROUTE] ${req.method} ${req.url}`);
  next();
});

// GET all medicines (with optional filters)
router.get('/', async (req, res) => {
  console.log('📥 GET /medicines (or /api/medicines) called');
  try {
    const { category, company, drugType, boxName, inStock, search, descriptionSearch } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 0);
    const limit = Math.min(60, Math.max(1, Number.parseInt(req.query.limit, 10) || 0));
    const usePagination = page > 0 && limit > 0;
    const filter = {};
    if (category && category !== 'All') filter.category = category;
    if (company && company !== 'All') filter.manufacturer = { $regex: `^${escapeRegex(company)}$`, $options: 'i' };
    if (drugType && drugType !== 'All') filter.drugType = drugType;
    if (boxName && boxName !== 'All') filter.boxName = boxName;
    if (inStock !== undefined && inStock !== '') filter.inStock = inStock === 'true';
    if (descriptionSearch) filter.description = { $regex: descriptionSearch, $options: 'i' };
    if (search) filter.$or = [
      { name:         { $regex: search, $options: 'i' } },
      { description:  { $regex: search, $options: 'i' } },
      { drugType:     { $regex: search, $options: 'i' } },
      { manufacturer: { $regex: search, $options: 'i' } },
      { boxName:      { $regex: search, $options: 'i' } },
      { category:     { $regex: search, $options: 'i' } },
    ];
    console.log('🔍 Query filter:', filter);
    if (usePagination) {
      const [medicines, total] = await Promise.all([
        Medicine.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Medicine.countDocuments(filter),
      ]);
      console.log('ðŸ“¤ Found', medicines.length, 'medicines');
      return res.json({
        success: true,
        data: medicines,
        pagination: {
          page,
          limit,
          total,
          hasMore: page * limit < total,
        },
      });
    }

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

// GET all unique companies
router.get('/meta/companies', async (req, res) => {
  try {
    const companies = (await Medicine.distinct('manufacturer'))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    res.json({ success: true, data: companies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all unique drug types
router.get('/meta/drug-types', async (req, res) => {
  try {
    const drugTypes = (await Medicine.distinct('drugType'))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    res.json({ success: true, data: drugTypes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all unique boxes
router.get('/meta/boxes', async (req, res) => {
  try {
    const boxes = (await Medicine.distinct('boxName'))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    res.json({ success: true, data: boxes });
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
    const { name, category, drugType, description, manufacturer, boxName, sideEffects, inStock } = req.body;
    let existingImages = [];
    if (req.body.keepImages) {
      try {
        existingImages = JSON.parse(req.body.keepImages);
        if (!Array.isArray(existingImages)) existingImages = [];
      } catch {
        existingImages = [];
      }
    }
    
    // Handle multiple images to Cloudinary
    let newImages = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
      newImages = await Promise.all(uploadPromises);
    }
    
    // For backward compatibility, set the first image as the main image
    const imageUrls = [...existingImages, ...newImages].slice(0, 10);
    const mainImage = imageUrls.length > 0 ? imageUrls[0] : '';
    
    const medicine = new Medicine({
      name, 
      category, 
      drugType: drugType || '',
      description, 
      manufacturer,
      boxName: boxName || '',
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
    
    const { name, category, drugType, description, manufacturer, boxName, sideEffects, inStock, keepImages } = req.body;
    
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
        boxName: boxName || '',
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
