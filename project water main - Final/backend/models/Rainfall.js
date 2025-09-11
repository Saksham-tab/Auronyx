const mongoose = require('mongoose');

const RainfallSchema = new mongoose.Schema({
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true },
    address: { type: Object, default: {} }
  },
  rainfallData: { type: Object, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rainfall', RainfallSchema);
