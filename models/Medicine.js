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

module.exports = mongoose.model('Medicine', medicineSchema);
