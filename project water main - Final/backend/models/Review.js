const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: {
      district: String,
      street: String,
      city: String,
      state: String,
      country: String
    }
  },
  // Optional user reference (public submissions allowed)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // Align with route filters
  source: {
    type: String,
    default: 'user_review'
  },
  reviewData: {
    overallRating: { type: Number, min: 1, max: 5, required: true },
    taste: {
      rating: { type: Number, min: 1, max: 5 },
      description: String
    },
    clarity: {
      rating: { type: Number, min: 1, max: 5 },
      description: String
    },
    odor: {
      rating: { type: Number, min: 1, max: 5 },
      description: String
    },
    healthEffects: [String],
    additionalComments: String,
    images: [String]
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, { timestamps: true, collection: 'Review' });

// Create geospatial index for location-based queries
reviewSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Review', reviewSchema);
