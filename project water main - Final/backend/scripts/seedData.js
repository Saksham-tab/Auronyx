const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const WaterQuality = require('../models/WaterQuality');
const ESP32Device = require('../models/ESP32Device');
const { logger } = require('../utils/logger');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/water_quality_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Sample data
const sampleUsers = [
  {
    username: 'admin',
    email: 'admin@waterquality.com',
    password: 'admin123',
    firstName: 'System',
    lastName: 'Administrator',
    role: 'admin',
    isVerified: true,
    isActive: true,
    phone: '+1234567890',
    location: {
      type: 'Point',
      coordinates: [-74.006, 40.7128], // New York
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        country: 'USA'
      }
    },
    preferences: {
      notifications: {
        email: true,
        sms: true,
        push: true
      },
      privacy: {
        profileVisibility: 'public',
        dataSharing: true
      }
    }
  },
  {
    username: 'john_doe',
    email: 'john.doe@example.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe',
    role: 'user',
    isVerified: true,
    isActive: true,
    phone: '+1234567891',
    location: {
      type: 'Point',
      coordinates: [-74.006, 40.7128],
      address: {
        street: '456 Oak Ave',
        city: 'New York',
        state: 'NY',
        country: 'USA'
      }
    },
    preferences: {
      notifications: {
        email: true,
        sms: false,
        push: true
      },
      privacy: {
        profileVisibility: 'public',
        dataSharing: true
      }
    }
  },
  {
    username: 'jane_smith',
    email: 'jane.smith@example.com',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'moderator',
    isVerified: true,
    isActive: true,
    phone: '+1234567892',
    location: {
      type: 'Point',
      coordinates: [-74.006, 40.7128],
      address: {
        street: '789 Pine St',
        city: 'New York',
        state: 'NY',
        country: 'USA'
      }
    },
    preferences: {
      notifications: {
        email: true,
        sms: true,
        push: false
      },
      privacy: {
        profileVisibility: 'public',
        dataSharing: true
      }
    }
  }
];

const sampleESP32Devices = [
  {
    deviceId: 'ESP32_001',
    name: 'Central Park Water Monitor',
    location: {
      type: 'Point',
      coordinates: [-73.9654, 40.7829], // Central Park
      address: {
        street: 'Central Park',
        city: 'New York',
        state: 'NY',
        country: 'USA'
      }
    },
    status: 'online',
    lastSeen: new Date(),
    ipAddress: '192.168.1.100',
    macAddress: 'AA:BB:CC:DD:EE:01',
    sensors: {
      ph: { enabled: true, calibrationOffset: 0 },
      turbidity: { enabled: true, calibrationOffset: 0 },
      temperature: { enabled: true, calibrationOffset: 0 },
      tds: { enabled: true, calibrationOffset: 0 },
      conductivity: { enabled: true, calibrationOffset: 0 },
      dissolvedOxygen: { enabled: true, calibrationOffset: 0 }
    },
    thresholds: {
      ph: { min: 6.5, max: 8.5, criticalMin: 6.0, criticalMax: 9.0 },
      turbidity: { max: 5.0, criticalMax: 10.0 },
      temperature: { min: 10, max: 35, criticalMin: 5, criticalMax: 40 },
      tds: { min: 50, max: 500, criticalMin: 0, criticalMax: 1000 },
      dissolvedOxygen: { min: 6.0, criticalMin: 4.0 }
    },
    configuration: {
      samplingInterval: 300000, // 5 minutes
      uploadInterval: 60000, // 1 minute
      wifiSSID: 'WaterQualityNetwork',
      timezone: 'America/New_York'
    }
  },
  {
    deviceId: 'ESP32_002',
    name: 'Hudson River Monitor',
    location: {
      type: 'Point',
      coordinates: [-74.006, 40.7128], // Hudson River
      address: {
        street: 'Hudson River',
        city: 'New York',
        state: 'NY',
        country: 'USA'
      }
    },
    status: 'online',
    lastSeen: new Date(),
    ipAddress: '192.168.1.101',
    macAddress: 'AA:BB:CC:DD:EE:02',
    sensors: {
      ph: { enabled: true, calibrationOffset: 0 },
      turbidity: { enabled: true, calibrationOffset: 0 },
      temperature: { enabled: true, calibrationOffset: 0 },
      tds: { enabled: true, calibrationOffset: 0 },
      conductivity: { enabled: true, calibrationOffset: 0 },
      dissolvedOxygen: { enabled: true, calibrationOffset: 0 }
    },
    thresholds: {
      ph: { min: 6.5, max: 8.5, criticalMin: 6.0, criticalMax: 9.0 },
      turbidity: { max: 5.0, criticalMax: 10.0 },
      temperature: { min: 10, max: 35, criticalMin: 5, criticalMax: 40 },
      tds: { min: 50, max: 500, criticalMin: 0, criticalMax: 1000 },
      dissolvedOxygen: { min: 6.0, criticalMin: 4.0 }
    },
    configuration: {
      samplingInterval: 300000,
      uploadInterval: 60000,
      wifiSSID: 'WaterQualityNetwork',
      timezone: 'America/New_York'
    }
  }
];

const sampleWaterQualityData = [
  {
    location: {
      type: 'Point',
      coordinates: [-73.9654, 40.7829], // Central Park
      address: {
        street: 'Central Park',
        city: 'New York',
        state: 'NY',
        country: 'USA'
      }
    },
    source: 'esp32',
    deviceId: 'ESP32_001',
    timestamp: new Date(Date.now() - 3600000), // 1 hour ago
    sensorData: {
      ph: { value: 7.2, unit: 'pH' },
      turbidity: { value: 2.1, unit: 'NTU' },
      temperature: { value: 22.5, unit: '°C' },
      tds: { value: 150, unit: 'ppm' },
      conductivity: { value: 300, unit: 'µS/cm' },
      dissolvedOxygen: { value: 8.5, unit: 'mg/L' }
    },
    qualityScore: 85,
    assessment: {
      status: 'excellent',
      summary: 'Water quality is excellent with all parameters within safe limits.',
      details: {
        ph: { status: 'good', value: 7.2, range: '6.5-8.5' },
        turbidity: { status: 'good', value: 2.1, range: '<5.0' },
        temperature: { status: 'good', value: 22.5, range: '10-35' },
        tds: { status: 'good', value: 150, range: '50-500' },
        dissolvedOxygen: { status: 'good', value: 8.5, range: '>6.0' }
      }
    },
    weatherConditions: {
      temperature: 25.0,
      humidity: 65,
      rainfall: { amount: 0, unit: 'mm' },
      windSpeed: 12,
      pressure: 1013,
      description: 'Partly cloudy'
    },
    alerts: {
      isAlert: false,
      acknowledged: false
    }
  },
  {
    location: {
      type: 'Point',
      coordinates: [-74.006, 40.7128], // Hudson River
      address: {
        street: 'Hudson River',
        city: 'New York',
        state: 'NY',
        country: 'USA'
      }
    },
    source: 'esp32',
    deviceId: 'ESP32_002',
    timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
    sensorData: {
      ph: { value: 7.8, unit: 'pH' },
      turbidity: { value: 4.2, unit: 'NTU' },
      temperature: { value: 24.0, unit: '°C' },
      tds: { value: 280, unit: 'ppm' },
      conductivity: { value: 450, unit: 'µS/cm' },
      dissolvedOxygen: { value: 7.2, unit: 'mg/L' }
    },
    qualityScore: 72,
    assessment: {
      status: 'good',
      summary: 'Water quality is good with slightly elevated turbidity levels.',
      details: {
        ph: { status: 'good', value: 7.8, range: '6.5-8.5' },
        turbidity: { status: 'fair', value: 4.2, range: '<5.0' },
        temperature: { status: 'good', value: 24.0, range: '10-35' },
        tds: { status: 'good', value: 280, range: '50-500' },
        dissolvedOxygen: { status: 'good', value: 7.2, range: '>6.0' }
      }
    },
    weatherConditions: {
      temperature: 26.5,
      humidity: 70,
      rainfall: { amount: 5.2, unit: 'mm' },
      windSpeed: 15,
      pressure: 1008,
      description: 'Light rain'
    },
    alerts: {
      isAlert: false,
      acknowledged: false
    }
  },
  {
    location: {
      type: 'Point',
      coordinates: [-74.006, 40.7128],
      address: {
        street: '456 Oak Ave',
        city: 'New York',
        state: 'NY',
        country: 'USA'
      }
    },
    source: 'user_review',
    userId: null, // Will be set after user creation
    timestamp: new Date(Date.now() - 7200000), // 2 hours ago
    reviewData: {
      overallRating: 4,
      taste: {
        rating: 4,
        description: 'Water tastes clean and fresh'
      },
      clarity: {
        rating: 3,
        description: 'Slightly cloudy but acceptable'
      },
      odor: {
        rating: 4,
        description: 'No noticeable odor'
      },
      healthEffects: ['none'],
      additionalComments: 'Generally good water quality in this area'
    },
    qualityScore: 75,
    assessment: {
      status: 'good',
      summary: 'User reports good water quality with minor clarity concerns.',
      details: {
        taste: { status: 'good', rating: 4 },
        clarity: { status: 'fair', rating: 3 },
        odor: { status: 'good', rating: 4 }
      }
    },
    weatherConditions: {
      temperature: 23.0,
      humidity: 68,
      rainfall: { amount: 0, unit: 'mm' },
      windSpeed: 10,
      pressure: 1015,
      description: 'Clear'
    },
    alerts: {
      isAlert: false,
      acknowledged: false
    }
  }
];

async function seedData() {
  try {
    logger.info('Starting data seeding...');

    // Clear existing data
    await User.deleteMany({});
    await WaterQuality.deleteMany({});
    await ESP32Device.deleteMany({});

    logger.info('Cleared existing data');

    // Create users
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      logger.info(`Created user: ${user.username}`);
    }

    // Create ESP32 devices
    for (const deviceData of sampleESP32Devices) {
      const device = new ESP32Device(deviceData);
      await device.save();
      logger.info(`Created ESP32 device: ${device.deviceId}`);
    }

    // Create water quality data
    for (const waterQualityData of sampleWaterQualityData) {
      // Set userId for user reviews
      if (waterQualityData.source === 'user_review') {
        waterQualityData.userId = createdUsers[1]._id; // john_doe
      }
      
      const waterQuality = new WaterQuality(waterQualityData);
      await waterQuality.save();
      logger.info(`Created water quality record: ${waterQuality._id}`);
    }

    logger.info('Data seeding completed successfully');
    
    // Print summary
    const userCount = await User.countDocuments();
    const waterQualityCount = await WaterQuality.countDocuments();
    const deviceCount = await ESP32Device.countDocuments();

    console.log('\n=== Seeding Summary ===');
    console.log(`Users created: ${userCount}`);
    console.log(`Water quality records created: ${waterQualityCount}`);
    console.log(`ESP32 devices created: ${deviceCount}`);
    console.log('\nDefault admin credentials:');
    console.log('Email: admin@waterquality.com');
    console.log('Password: admin123');
    console.log('\nDefault user credentials:');
    console.log('Email: john.doe@example.com');
    console.log('Password: password123');

  } catch (error) {
    logger.error('Data seeding error:', error);
    console.error('Error seeding data:', error.message);
  } finally {
    await mongoose.disconnect();
    logger.info('Database connection closed');
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedData();
}

module.exports = { seedData };
