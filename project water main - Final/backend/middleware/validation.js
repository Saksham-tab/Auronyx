const Joi = require('joi');
const { logger } = require('../utils/logger');

/**
 * Generic validation middleware
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      logger.warn('Validation error', {
        property,
        errors: error.details,
        url: req.url,
        method: req.method
      });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req[property] = value;
    next();
  };
};

/**
 * Location validation middleware
 */
const validateLocation = (req, res, next) => {
  const schema = Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lon: Joi.number().min(-180).max(180).required(),
    city: Joi.string().optional(),
    country: Joi.string().optional()
  });

  const { error } = schema.validate(req.query);
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid location parameters',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  next();
};

/**
 * Sensor data validation middleware
 */
const validateSensorData = (req, res, next) => {
  const sensorSchema = Joi.object({
    value: Joi.number().required(),
    unit: Joi.string().optional()
  });

  const locationSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      country: Joi.string().optional()
    }).optional()
  });

  const schema = Joi.object({
    deviceId: Joi.string().required(),
    timestamp: Joi.date().optional(),
    sensors: Joi.object({
      turbidity: sensorSchema.optional(),
      turbidity: sensorSchema.optional(),
      temperature: sensorSchema.optional(),
      tds: sensorSchema.optional(),
      conductivity: sensorSchema.optional(),
      dissolvedOxygen: sensorSchema.optional()
    }).min(1).required(),
    location: locationSchema.required(),
    batteryLevel: Joi.number().min(0).max(100).optional(),
    signalStrength: Joi.number().min(0).max(100).optional(),
    deviceTemperature: Joi.number().optional()
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn('Sensor data validation error', {
      errors: error.details,
      deviceId: req.body.deviceId
    });

    return res.status(400).json({
      success: false,
      message: 'Invalid sensor data',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  next();
};

/**
 * User registration validation
 */
const validateUserRegistration = validate(Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  location: Joi.object({
    coordinates: Joi.array().items(Joi.number()).length(2).optional(),
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      country: Joi.string().optional()
    }).optional()
  }).optional()
}));

/**
 * User login validation
 */
const validateUserLogin = validate(Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
}));

/**
 * Water quality review validation
 */
const validateWaterQualityReview = validate(Joi.object({
  location: Joi.object({
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      country: Joi.string().optional()
    }).optional()
  }).required(),
  reviewData: Joi.object({
    overallRating: Joi.number().min(1).max(5).required(),
    taste: Joi.object({
      rating: Joi.number().min(1).max(5).required(),
      description: Joi.string().max(500).optional()
    }).optional(),
    clarity: Joi.object({
      rating: Joi.number().min(1).max(5).required(),
      description: Joi.string().max(500).optional()
    }).optional(),
    odor: Joi.object({
      rating: Joi.number().min(1).max(5).required(),
      description: Joi.string().max(500).optional()
    }).optional(),
    healthEffects: Joi.array().items(
      Joi.string().valid('none', 'stomach_discomfort', 'skin_irritation', 'hair_loss', 'metallic_taste', 'other')
    ).optional(),
    additionalComments: Joi.string().max(1000).optional(),
    images: Joi.array().items(Joi.string().uri()).optional()
  }).required()
}));

/**
 * ESP32 device registration validation
 */
const validateESP32Registration = validate(Joi.object({
  deviceId: Joi.string().alphanum().min(3).max(50).required(),
  name: Joi.string().min(2).max(100).required(),
  location: Joi.object({
    longitude: Joi.number().min(-180).max(180).required(),
    latitude: Joi.number().min(-90).max(90).required(),
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      country: Joi.string().optional()
    }).optional()
  }).required(),
  sensors: Joi.object({
    turbidity: Joi.object({
      enabled: Joi.boolean().default(true),
      calibrationOffset: Joi.number().default(0)
    }).optional(),
    turbidity: Joi.object({
      enabled: Joi.boolean().default(true),
      calibrationOffset: Joi.number().default(0)
    }).optional(),
    temperature: Joi.object({
      enabled: Joi.boolean().default(true),
      calibrationOffset: Joi.number().default(0)
    }).optional(),
    tds: Joi.object({
      enabled: Joi.boolean().default(true),
      calibrationOffset: Joi.number().default(0)
    }).optional(),
    conductivity: Joi.object({
      enabled: Joi.boolean().default(true),
      calibrationOffset: Joi.number().default(0)
    }).optional(),
    dissolvedOxygen: Joi.object({
      enabled: Joi.boolean().default(true),
      calibrationOffset: Joi.number().default(0)
    }).optional()
  }).optional(),
  thresholds: Joi.object({
    turbidity: Joi.object({
      max: Joi.number().optional(),
      criticalMax: Joi.number().optional()
    }).optional(),
    turbidity: Joi.object({
      max: Joi.number().optional(),
      criticalMax: Joi.number().optional()
    }).optional(),
    temperature: Joi.object({
      min: Joi.number().optional(),
      max: Joi.number().optional(),
      criticalMin: Joi.number().optional(),
      criticalMax: Joi.number().optional()
    }).optional(),
    tds: Joi.object({
      min: Joi.number().optional(),
      max: Joi.number().optional(),
      criticalMin: Joi.number().optional(),
      criticalMax: Joi.number().optional()
    }).optional(),
    dissolvedOxygen: Joi.object({
      min: Joi.number().optional(),
      criticalMin: Joi.number().optional()
    }).optional()
  }).optional(),
  configuration: Joi.object({
    samplingInterval: Joi.number().min(60000).max(3600000).optional(),
    uploadInterval: Joi.number().min(30000).max(300000).optional(),
    wifiSSID: Joi.string().optional(),
    wifiPassword: Joi.string().optional(),
    timezone: Joi.string().optional()
  }).optional()
}));

/**
 * Weather alert validation
 */
const validateWeatherAlert = validate(Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lon: Joi.number().min(-180).max(180).required(),
  alertTypes: Joi.array().items(
    Joi.string().valid('rain', 'storm', 'flood', 'water_quality')
  ).min(1).required(),
  threshold: Joi.number().min(0).required(),
  notificationMethod: Joi.array().items(
    Joi.string().valid('email', 'sms', 'push')
  ).min(1).required()
}));

module.exports = {
  validate,
  validateLocation,
  validateSensorData,
  validateUserRegistration,
  validateUserLogin,
  validateWaterQualityReview,
  validateESP32Registration,
  validateWeatherAlert
};
