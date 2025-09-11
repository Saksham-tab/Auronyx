const express = require('express');
const router = express.Router();
const ESP32Device = require('../models/ESP32Device');
const WaterQuality = require('../models/WaterQuality');
const { logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { validateSensorData } = require('../middleware/validation');
const { io } = require('../server');

/**
 * @route POST /api/esp32/data
 * @desc Receive sensor data from ESP32 device
 * @access Public (for ESP32 devices)
 */
router.post('/data', validateSensorData, async (req, res) => {
  try {
    const {
      deviceId,
      timestamp,
      sensors,
      location,
      batteryLevel,
      signalStrength,
      deviceTemperature
    } = req.body;

    // Find or create ESP32 device
    let device = await ESP32Device.findOne({ deviceId });
    
    if (!device) {
      // Create new device if it doesn't exist
      device = new ESP32Device({
        deviceId,
        name: `ESP32-${deviceId}`,
        location: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
          address: location.address || {}
        },
        status: 'online'
      });
    }

    // Update device status and health
    device.status = 'online';
    device.lastSeen = new Date();
    device.health.batteryLevel = batteryLevel || device.health.batteryLevel;
    device.health.signalStrength = signalStrength || device.health.signalStrength;
    device.health.temperature = deviceTemperature || device.health.temperature;

    // Process sensor data
    const sensorData = {};
    let hasValidData = false;

    Object.keys(sensors).forEach(sensorKey => {
      const sensor = sensors[sensorKey];
      if (sensor && sensor.value !== undefined && sensor.value !== null) {
        sensorData[sensorKey] = {
          value: sensor.value,
          unit: sensor.unit || getDefaultUnit(sensorKey),
          status: determineSensorStatus(sensorKey, sensor.value, device.thresholds[sensorKey])
        };
        hasValidData = true;
      }
    });

    if (!hasValidData) {
      return res.status(400).json({
        success: false,
        message: 'No valid sensor data provided'
      });
    }

    // Create water quality record
    const waterQualityData = new WaterQuality({
      location: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
        address: location.address || {}
      },
      source: 'esp32',
      deviceId,
      timestamp: timestamp || new Date(),
      sensorData,
      weatherConditions: await getWeatherConditions(location.latitude, location.longitude)
    });

    await waterQualityData.save();

    // Update device statistics
    await device.recordReading(true);

    // Emit real-time data via Socket.IO
    io.emit('esp32-data', {
      deviceId,
      timestamp: waterQualityData.timestamp,
      sensorData,
      qualityScore: waterQualityData.qualityScore,
      location: waterQualityData.location
    });

    // Check for alerts
    const alerts = checkForAlerts(waterQualityData, device);
    if (alerts.length > 0) {
      io.emit('water-quality-alert', {
        deviceId,
        alerts,
        location: waterQualityData.location,
        timestamp: waterQualityData.timestamp
      });
    }

    res.json({
      success: true,
      message: 'Data received successfully',
      qualityScore: waterQualityData.qualityScore,
      alerts: alerts.length > 0 ? alerts : null
    });

  } catch (error) {
    logger.error('ESP32 data processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process sensor data',
      error: error.message
    });
  }
});

/**
 * @route GET /api/esp32/devices
 * @desc Get all ESP32 devices
 * @access Private
 */
router.get('/devices', authMiddleware, async (req, res) => {
  try {
    const { status, location } = req.query;
    
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (location) {
      const [lat, lon] = location.split(',').map(Number);
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          },
          $maxDistance: 10000 // 10km radius
        }
      };
    }

    const devices = await ESP32Device.find(query)
      .select('-configuration.wifiPassword')
      .sort({ lastSeen: -1 });

    res.json({
      success: true,
      data: devices,
      count: devices.length
    });
  } catch (error) {
    logger.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch devices',
      error: error.message
    });
  }
});

/**
 * @route GET /api/esp32/devices/:deviceId
 * @desc Get specific ESP32 device details
 * @access Private
 */
router.get('/devices/:deviceId', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = await ESP32Device.findOne({ deviceId })
      .select('-configuration.wifiPassword');
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Get recent readings for this device
    const recentReadings = await WaterQuality.find({ 
      deviceId,
      source: 'esp32'
    })
    .sort({ timestamp: -1 })
    .limit(10);

    res.json({
      success: true,
      data: {
        device,
        recentReadings
      }
    });
  } catch (error) {
    logger.error('Get device error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device details',
      error: error.message
    });
  }
});

/**
 * @route POST /api/esp32/devices
 * @desc Register new ESP32 device
 * @access Private
 */
router.post('/devices', authMiddleware, async (req, res) => {
  try {
    const {
      deviceId,
      name,
      location,
      sensors,
      thresholds,
      configuration
    } = req.body;

    // Check if device already exists
    const existingDevice = await ESP32Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({
        success: false,
        message: 'Device with this ID already exists'
      });
    }

    const device = new ESP32Device({
      deviceId,
      name,
      location: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
        address: location.address || {}
      },
      sensors: sensors || {},
      thresholds: thresholds || {},
      configuration: configuration || {},
      accessControl: {
        adminUsers: [req.user.id]
      }
    });

    await device.save();

    res.status(201).json({
      success: true,
      message: 'Device registered successfully',
      data: device
    });
  } catch (error) {
    logger.error('Device registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register device',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/esp32/devices/:deviceId
 * @desc Update ESP32 device configuration
 * @access Private
 */
router.put('/devices/:deviceId', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const updateData = req.body;

    const device = await ESP32Device.findOne({ deviceId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check if user has permission to update this device
    if (!device.accessControl.adminUsers.includes(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update device
    Object.assign(device, updateData);
    await device.save();

    res.json({
      success: true,
      message: 'Device updated successfully',
      data: device
    });
  } catch (error) {
    logger.error('Device update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update device',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/esp32/devices/:deviceId
 * @desc Delete ESP32 device
 * @access Private
 */
router.delete('/devices/:deviceId', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await ESP32Device.findOne({ deviceId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check if user has permission to delete this device
    if (!device.accessControl.adminUsers.includes(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await ESP32Device.deleteOne({ deviceId });

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    logger.error('Device deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete device',
      error: error.message
    });
  }
});

/**
 * @route GET /api/esp32/devices/:deviceId/readings
 * @desc Get sensor readings for a specific device
 * @access Private
 */
router.get('/devices/:deviceId/readings', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 100, startDate, endDate } = req.query;

    let query = { deviceId, source: 'esp32' };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const readings = await WaterQuality.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: readings,
      count: readings.length
    });
  } catch (error) {
    logger.error('Get readings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch readings',
      error: error.message
    });
  }
});

/**
 * @route POST /api/esp32/devices/:deviceId/calibrate
 * @desc Calibrate sensors for a device
 * @access Private
 */
router.post('/devices/:deviceId/calibrate', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { sensor, offset, referenceValue } = req.body;

    const device = await ESP32Device.findOne({ deviceId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (!device.sensors[sensor]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sensor type'
      });
    }

    // Update calibration data
    device.sensors[sensor].calibrationOffset = offset || 0;
    device.sensors[sensor].lastCalibration = new Date();
    device.sensors[sensor].nextCalibration = new Date();
    device.sensors[sensor].nextCalibration.setDate(device.sensors[sensor].nextCalibration.getDate() + 30);

    await device.save();

    res.json({
      success: true,
      message: 'Sensor calibrated successfully',
      data: device.sensors[sensor]
    });
  } catch (error) {
    logger.error('Sensor calibration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calibrate sensor',
      error: error.message
    });
  }
});

// Helper functions
function getDefaultUnit(sensorType) {
  const units = {
    ph: 'pH',
    turbidity: 'NTU',
    temperature: '°C',
    tds: 'ppm',
    conductivity: 'µS/cm',
    dissolvedOxygen: 'mg/L'
  };
  return units[sensorType] || '';
}

function determineSensorStatus(sensorType, value, thresholds) {
  if (!thresholds) return 'normal';

  const { min, max, criticalMin, criticalMax } = thresholds;

  if (criticalMin !== undefined && value < criticalMin) return 'critical';
  if (criticalMax !== undefined && value > criticalMax) return 'critical';
  if (min !== undefined && value < min) return 'low';
  if (max !== undefined && value > max) return 'high';

  return 'normal';
}

async function getWeatherConditions(lat, lon) {
  try {
    const axios = require('axios');
    const url = `https://api.openweathermap.org/data/2.5/weather`;
    const params = {
      lat,
      lon,
      appid: process.env.OPENWEATHER_API_KEY,
      units: 'metric'
    };

    const response = await axios.get(url, { params });
    const data = response.data;

    return {
      temperature: data.main.temp,
      humidity: data.main.humidity,
      rainfall: {
        amount: data.rain ? data.rain['1h'] : 0,
        unit: 'mm'
      },
      windSpeed: data.wind.speed,
      pressure: data.main.pressure,
      description: data.weather[0].description
    };
  } catch (error) {
    logger.error('Weather API error:', error);
    return null;
  }
}

function checkForAlerts(waterQualityData, device) {
  const alerts = [];

  // Check sensor thresholds
  Object.keys(waterQualityData.sensorData).forEach(sensorKey => {
    const sensorData = waterQualityData.sensorData[sensorKey];
    const thresholds = device.thresholds[sensorKey];

    if (sensorData && thresholds) {
      const { value } = sensorData;
      const { min, max, criticalMin, criticalMax } = thresholds;

      if (criticalMin !== undefined && value < criticalMin) {
        alerts.push({
          type: 'critical',
          sensor: sensorKey,
          message: `${sensorKey.toUpperCase()} is critically low: ${value}${sensorData.unit}`,
          value,
          threshold: criticalMin
        });
      } else if (criticalMax !== undefined && value > criticalMax) {
        alerts.push({
          type: 'critical',
          sensor: sensorKey,
          message: `${sensorKey.toUpperCase()} is critically high: ${value}${sensorData.unit}`,
          value,
          threshold: criticalMax
        });
      } else if (min !== undefined && value < min) {
        alerts.push({
          type: 'warning',
          sensor: sensorKey,
          message: `${sensorKey.toUpperCase()} is below normal: ${value}${sensorData.unit}`,
          value,
          threshold: min
        });
      } else if (max !== undefined && value > max) {
        alerts.push({
          type: 'warning',
          sensor: sensorKey,
          message: `${sensorKey.toUpperCase()} is above normal: ${value}${sensorData.unit}`,
          value,
          threshold: max
        });
      }
    }
  });

  // Check overall quality score
  if (waterQualityData.qualityScore < 40) {
    alerts.push({
      type: 'critical',
      sensor: 'overall',
      message: `Water quality is critically poor: ${waterQualityData.qualityScore}/100`,
      value: waterQualityData.qualityScore,
      threshold: 40
    });
  } else if (waterQualityData.qualityScore < 60) {
    alerts.push({
      type: 'warning',
      sensor: 'overall',
      message: `Water quality is below normal: ${waterQualityData.qualityScore}/100`,
      value: waterQualityData.qualityScore,
      threshold: 60
    });
  }

  return alerts;
}

module.exports = router;
