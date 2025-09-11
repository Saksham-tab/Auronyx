const mongoose = require('mongoose');

const waterQualitySchema = new mongoose.Schema({
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
      street: String,
      city: String,
      state: String,
      country: String
    }
  },
  source: {
    type: String,
    enum: ['esp32', 'user_review', 'manual_entry'],
    required: true
  },
  deviceId: {
    type: String,
    required: function() { return this.source === 'esp32'; }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return this.source === 'user_review'; }
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  // Sensor readings from ESP32
  sensorData: {
    turbidity: {
      value: Number,
      unit: { type: String, default: 'NTU' },
      status: { type: String, enum: ['normal', 'high', 'low', 'critical'] }
    },
    turbidity: {
      value: Number,
      unit: { type: String, default: 'NTU' },
      status: { type: String, enum: ['normal', 'high', 'low', 'critical'] }
    },
    temperature: {
      value: Number,
      unit: { type: String, default: '°C' },
      status: { type: String, enum: ['normal', 'high', 'low', 'critical'] }
    },
    tds: {
      value: Number,
      unit: { type: String, default: 'ppm' },
      status: { type: String, enum: ['normal', 'high', 'low', 'critical'] }
    },
    conductivity: {
      value: Number,
      unit: { type: String, default: 'µS/cm' },
      status: { type: String, enum: ['normal', 'high', 'low', 'critical'] }
    },
    dissolvedOxygen: {
      value: Number,
      unit: { type: String, default: 'mg/L' },
      status: { type: String, enum: ['normal', 'high', 'low', 'critical'] }
    }
  },
  // User review data
  reviewData: {
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
      required: function() { return this.source === 'user_review'; }
    },
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
    healthEffects: {
      type: [String],
      enum: ['none', 'stomach_discomfort', 'skin_irritation', 'hair_loss', 'metallic_taste', 'other']
    },
    additionalComments: String,
    images: [String] // URLs to uploaded images
  },
  // Calculated quality score
  qualityScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  // Weather conditions at time of measurement
  weatherConditions: {
    temperature: Number,
    humidity: Number,
    rainfall: {
      amount: Number,
      unit: { type: String, default: 'mm' }
    },
    windSpeed: Number,
    pressure: Number,
    description: String
  },
  // Quality assessment
  assessment: {
    status: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'critical'],
      required: true
    },
    recommendations: [String],
    risks: [String],
    isDrinkable: {
      type: Boolean,
      default: true
    },
    requiresTreatment: {
      type: Boolean,
      default: false
    }
  },
  // Metadata
  metadata: {
    dataQuality: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    },
    lastCalibration: Date,
    maintenanceDue: Date
  },
  // Flags for alerts
  alerts: {
    isAlert: {
      type: Boolean,
      default: false
    },
    alertType: {
      type: String,
      enum: ['critical', 'warning', 'info']
    },
    alertMessage: String,
    acknowledged: {
      type: Boolean,
      default: false
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acknowledgedAt: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
waterQualitySchema.index({ location: '2dsphere' });
waterQualitySchema.index({ timestamp: -1 });
waterQualitySchema.index({ source: 1 });
waterQualitySchema.index({ deviceId: 1 });
waterQualitySchema.index({ userId: 1 });
waterQualitySchema.index({ 'assessment.status': 1 });
waterQualitySchema.index({ qualityScore: -1 });

// Compound indexes
waterQualitySchema.index({ location: '2dsphere', timestamp: -1 });
waterQualitySchema.index({ source: 1, timestamp: -1 });

// Pre-save middleware to calculate quality score
waterQualitySchema.pre('save', function(next) {
  if (this.isModified('sensorData') || this.isModified('reviewData')) {
    this.qualityScore = this.calculateQualityScore();
    this.assessment.status = this.determineStatus();
  }
  next();
});

// Method to calculate quality score
waterQualitySchema.methods.calculateQualityScore = function() {
  let score = 0;
  let totalWeight = 0;

  if (this.source === 'esp32' && this.sensorData) {
    // Sensor-based scoring
    const sensorWeights = {
      turbidity: 0.45,
      tds: 0.20,
      temperature: 0.15,
      dissolvedOxygen: 0.20
    };

    Object.keys(sensorWeights).forEach(param => {
      if (this.sensorData[param] && this.sensorData[param].value !== undefined) {
        const value = this.sensorData[param].value;
        const weight = sensorWeights[param];
        
        let paramScore = 100;
        
        // Turbidity scoring (lower is better, < 5 NTU is good)
        if (param === 'turbidity') {
          if (value < 5) paramScore = 100;
          else if (value < 10) paramScore = 80;
          else if (value < 20) paramScore = 60;
          else paramScore = 30;
        }
        // TDS scoring (150-500 ppm is ideal)
        else if (param === 'tds') {
          if (value >= 150 && value <= 500) paramScore = 100;
          else if (value >= 100 && value <= 750) paramScore = 80;
          else if (value >= 50 && value <= 1000) paramScore = 60;
          else paramScore = 40;
        }
        // Temperature scoring (10-25°C is ideal)
        else if (param === 'temperature') {
          if (value >= 10 && value <= 25) paramScore = 100;
          else if (value >= 5 && value <= 30) paramScore = 80;
          else paramScore = 60;
        }
        // Dissolved Oxygen scoring (> 6 mg/L is good)
        else if (param === 'dissolvedOxygen') {
          if (value > 6) paramScore = 100;
          else if (value > 4) paramScore = 80;
          else if (value > 2) paramScore = 60;
          else paramScore = 30;
        }

        score += paramScore * weight;
        totalWeight += weight;
      }
    });
  } else if (this.source === 'user_review' && this.reviewData) {
    // Review-based scoring
    const reviewWeights = {
      overallRating: 0.4,
      taste: 0.2,
      clarity: 0.2,
      odor: 0.2
    };

    Object.keys(reviewWeights).forEach(param => {
      if (this.reviewData[param] && this.reviewData[param].rating) {
        const rating = this.reviewData[param].rating;
        const weight = reviewWeights[param];
        
        // Convert 1-5 rating to 0-100 score
        const paramScore = (rating / 5) * 100;
        
        score += paramScore * weight;
        totalWeight += weight;
      }
    });
  }

  return totalWeight > 0 ? Math.round(score / totalWeight) : 50;
};

// Method to determine status based on quality score
waterQualitySchema.methods.determineStatus = function() {
  if (this.qualityScore >= 80) return 'excellent';
  if (this.qualityScore >= 60) return 'good';
  if (this.qualityScore >= 40) return 'fair';
  if (this.qualityScore >= 20) return 'poor';
  return 'critical';
};

// Method to get location coordinates
waterQualitySchema.methods.getCoordinates = function() {
  return this.location.coordinates;
};

// Method to get formatted address
waterQualitySchema.methods.getFormattedAddress = function() {
  const addr = this.location.address;
  return `${addr.street}, ${addr.city}, ${addr.state}, ${addr.country}`;
};

module.exports = mongoose.model('WaterQuality', waterQualitySchema);
