const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    drugType: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    manufacturer: {
      type: String,
      required: true,
    },
    boxName: {
      type: String,
      default: '',
      trim: true,
    },
    sideEffects: {
      type: String,
      default: '',
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    image: {
      type: String,
      default: '',
    },
    // Multiple images support (max 10)
    images: [{
      type: String,
      default: '',
    }],
  },
  { timestamps: true }
);

medicineSchema.index({ createdAt: -1 });
medicineSchema.index({ category: 1, createdAt: -1 });
medicineSchema.index({ manufacturer: 1, createdAt: -1 });
medicineSchema.index({ drugType: 1, createdAt: -1 });
medicineSchema.index({ boxName: 1, createdAt: -1 });

module.exports = mongoose.model('Medicine', medicineSchema);
