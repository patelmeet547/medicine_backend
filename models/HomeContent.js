const mongoose = require('mongoose');

const statSchema = new mongoose.Schema({
  value: { type: String, default: '' },
  label: { type: String, default: '' },
}, { _id: false });

const standardSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  icon: { type: String, default: 'shield' },
}, { _id: false });

const homeContentSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  heroBadge: { type: String, default: '' },
  heroTitle: { type: String, default: '' },
  heroHighlight: { type: String, default: '' },
  heroText: { type: String, default: '' },
  heroButtonText: { type: String, default: '' },
  heroPrimaryImage: { type: String, default: '' },
  heroSecondaryImage: { type: String, default: '' },
  stats: [statSchema],
  categoriesEyebrow: { type: String, default: '' },
  categoriesTitle: { type: String, default: '' },
  categoriesText: { type: String, default: '' },
  aboutEyebrow: { type: String, default: '' },
  aboutTitle: { type: String, default: '' },
  aboutLead: { type: String, default: '' },
  aboutText: { type: String, default: '' },
  standardsEyebrow: { type: String, default: '' },
  standardsTitle: { type: String, default: '' },
  standards: [standardSchema],
  footerText: { type: String, default: '' },
  footerEmail: { type: String, default: '' },
  footerPhone: { type: String, default: '' },
  footerAddress: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('HomeContent', homeContentSchema);
