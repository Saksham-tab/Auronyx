const mongoose = require('mongoose');

const esp32DeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
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
  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance', 'error'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String,
    trim: true
  },
  macAddress: {
    type: String,
    trim: true
  },
  // Sensor configuration
  sensors: {
    turbidity: {
      enabled: { type: Boolean, default: true },
      calibrationOffset: { type: Number, default: 0 },
      lastCalibration: Date,
      nextCalibration: Date
    },
    turbidity: {
      enabled: { type: Boolean, default: true },
      calibrationOffset: { type: Number, default: 0 },
      lastCalibration: Date,
      nextCalibration: Date
    },
    temperature: {
      enabled: { type: Boolean, default: true },
      calibrationOffset: { type: Number, default: 0 },
      lastCalibration: Date,
      nextCalibration: Date
    },
    tds: {
      enabled: { type: Boolean, default: true },
      calibrationOffset: { type: Number, default: 0 },
      lastCalibration: Date,
      nextCalibration: Date
    },
    conductivity: {
      enabled: { type: Boolean, default: true },
      calibrationOffset: { type: Number, default: 0 },
      lastCalibration: Date,
      nextCalibration: Date
    },
    dissolvedOxygen: {
      enabled: { type: Boolean, default: true },
      calibrationOffset: { type: Number, default: 0 },
      lastCalibration: Date,
      nextCalibration: Date
    }
  },
  // Device configuration
  configuration: {
    samplingInterval: {
      type: Number,
      default: 300000, // 5 minutes in milliseconds
      min: 60000, // Minimum 1 minute
      max: 3600000 // Maximum 1 hour
    },
    uploadInterval: {
      type: Number,
      default: 60000, // 1 minute
      min: 30000, // Minimum 30 seconds
      max: 300000 // Maximum 5 minutes
    },
    wifiSSID: String,
    wifiPassword: String,
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  // Alert thresholds
  thresholds: {
    turbidity: {
      max: { type: Number, default: 5.0 },
      criticalMax: { type: Number, default: 20.0 }
    },
    turbidity: {
      max: { type: Number, default: 5.0 },
      criticalMax: { type: Number, default: 20.0 }
    },
    temperature: {
      min: { type: Number, default: 10.0 },
      max: { type: Number, default: 25.0 },
      criticalMin: { type: Number, default: 5.0 },
      criticalMax: { type: Number, default: 35.0 }
    },
    tds: {
      min: { type: Number, default: 150.0 },
      max: { type: Number, default: 500.0 },
      criticalMin: { type: Number, default: 50.0 },
      criticalMax: { type: Number, default: 1000.0 }
    }
    
  },
  // Device health and maintenance
  health: {
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    signalStrength: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    temperature: {
      type: Number,
      default: 25
    },
    uptime: {
      type: Number,
      default: 0
    },
    lastRestart: Date,
    errorCount: {
      type: Number,
      default: 0
    },
    lastError: {
      message: String,
      timestamp: Date,
      code: String
    }
  },
  // Statistics
  statistics: {
    totalReadings: {
      type: Number,
      default: 0
    },
    successfulReadings: {
      type: Number,
      default: 0
    },
    failedReadings: {
      type: Number,
      default: 0
    },
    lastReadingTime: Date,
    averageQualityScore: {
      type: Number,
      default: 0
    }
  },
  // Metadata
  metadata: {
    manufacturer: {
      type: String,
      default: 'ESP32'
    },
    model: {
      type: String,
      default: 'ESP32-WROOM-32'
    },
    firmwareVersion: {
      type: String,
      default: '1.0.0'
    },
    hardwareVersion: {
      type: String,
      default: '1.0.0'
    },
    installationDate: {
      type: Date,
      default: Date.now
    },
    warrantyExpiry: Date,
    notes: String
  },
  // Access control
  accessControl: {
    isPublic: {
      type: Boolean,
      default: false
    },
    allowedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    adminUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }
}, {
  timestamps: true
});

// Indexes
esp32DeviceSchema.index({ deviceId: 1 });
esp32DeviceSchema.index({ location: '2dsphere' });
esp32DeviceSchema.index({ status: 1 });
esp32DeviceSchema.index({ lastSeen: -1 });
esp32DeviceSchema.index({ 'health.batteryLevel': 1 });

// Pre-save middleware
esp32DeviceSchema.pre('save', function(next) {
  // Update lastSeen when status changes to online
  if (this.isModified('status') && this.status === 'online') {
    this.lastSeen = new Date();
  }
  
  // Calculate next calibration dates
  if (this.isModified('sensors')) {
    Object.keys(this.sensors).forEach(sensorKey => {
      const sensor = this.sensors[sensorKey];
      if (sensor.lastCalibration && !sensor.nextCalibration) {
        // Set next calibration to 30 days from last calibration
        sensor.nextCalibration = new Date(sensor.lastCalibration);
        sensor.nextCalibration.setDate(sensor.nextCalibration.getDate() + 30);
      }
    });
  }
  
  next();
});

// Method to check if device is online
esp32DeviceSchema.methods.isOnline = function() {
  const timeout = 5 * 60 * 1000; // 5 minutes
  return this.status === 'online' && (Date.now() - this.lastSeen.getTime()) < timeout;
};

// Method to update device status
esp32DeviceSchema.methods.updateStatus = function(status) {
  this.status = status;
  if (status === 'online') {
    this.lastSeen = new Date();
  }
  return this.save();
};

// Method to record a reading
esp32DeviceSchema.methods.recordReading = function(successful = true) {
  this.statistics.totalReadings += 1;
  if (successful) {
    this.statistics.successfulReadings += 1;
  } else {
    this.statistics.failedReadings += 1;
  }
  this.statistics.lastReadingTime = new Date();
  return this.save();
};

// Method to update health metrics
esp32DeviceSchema.methods.updateHealth = function(healthData) {
  Object.assign(this.health, healthData);
  this.lastSeen = new Date();
  return this.save();
};

// Method to record an error
esp32DeviceSchema.methods.recordError = function(error) {
  this.health.errorCount += 1;
  this.health.lastError = {
    message: error.message || 'Unknown error',
    timestamp: new Date(),
    code: error.code || 'UNKNOWN'
  };
  return this.save();
};

// Method to get device location as formatted string
esp32DeviceSchema.methods.getFormattedLocation = function() {
  const addr = this.location.address;
  return `${addr.street}, ${addr.city}, ${addr.state}, ${addr.country}`;
};

// Method to check if calibration is due
esp32DeviceSchema.methods.isCalibrationDue = function() {
  const now = new Date();
  return Object.values(this.sensors).some(sensor => 
    sensor.nextCalibration && sensor.nextCalibration <= now
  );
};

// Method to get devices that need calibration
esp32DeviceSchema.statics.getDevicesNeedingCalibration = function() {
  const now = new Date();
  return this.find({
    $or: Object.keys(this.schema.paths.sensors.schema.paths).map(sensorKey => ({
      [`sensors.${sensorKey}.nextCalibration`]: { $lte: now }
    }))
  });
};

// Method to get online devices
esp32DeviceSchema.statics.getOnlineDevices = function() {
  const timeout = 5 * 60 * 1000; // 5 minutes
  const cutoffTime = new Date(Date.now() - timeout);
  
  return this.find({
    status: 'online',
    lastSeen: { $gte: cutoffTime }
  });
};

module.exports = mongoose.model('ESP32Device', esp32DeviceSchema);
