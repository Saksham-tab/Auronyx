const express = require('express');
const router = express.Router();
const WaterQuality = require('../models/WaterQuality');
const { logger } = require('../utils/logger');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { validateWaterQualityReview } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route GET /api/water-quality
 * @desc Get water quality data with filters
 * @access Public
 */
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    lat,
    lon,
    radius = 10, // km
    source,
    startDate,
    endDate,
    limit = 50,
    page = 1,
    sortBy = 'timestamp',
    sortOrder = 'desc'
  } = req.query;

  let query = {};

  // Location-based filtering
  if (lat && lon) {
    query.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(lon), parseFloat(lat)]
        },
        $maxDistance: parseFloat(radius) * 1000 // Convert km to meters
      }
    };
  }

  // Source filtering
  if (source) {
    query.source = source;
  }

  // Date filtering
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Sorting
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const waterQualityData = await WaterQuality.find(query)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .populate('userId', 'firstName lastName username')
    .lean();

  const total = await WaterQuality.countDocuments(query);

  res.json({
    success: true,
    data: waterQualityData,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * @route GET /api/water-quality/:id
 * @desc Get specific water quality record
 * @access Public
 */
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const waterQuality = await WaterQuality.findById(id)
    .populate('userId', 'firstName lastName username')
    .populate('alerts.acknowledgedBy', 'firstName lastName');

  if (!waterQuality) {
    return res.status(404).json({
      success: false,
      message: 'Water quality record not found'
    });
  }

  res.json({
    success: true,
    data: waterQuality
  });
}));

/**
 * @route POST /api/water-quality/review
 * @desc Submit a water quality review
 * @access Private
 */
router.post('/review', authMiddleware, validateWaterQualityReview, asyncHandler(async (req, res) => {
  const { location, reviewData } = req.body;

  // Create water quality record from review
  const waterQuality = new WaterQuality({
    location: {
      type: 'Point',
      coordinates: location.coordinates,
      address: location.address || {}
    },
    source: 'user_review',
    userId: req.user.id,
    reviewData,
    weatherConditions: await getWeatherConditions(location.coordinates[1], location.coordinates[0])
  });

  await waterQuality.save();

  logger.logAPI(req, res, Date.now());

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully',
    data: {
      id: waterQuality._id,
      qualityScore: waterQuality.qualityScore,
      assessment: waterQuality.assessment
    }
  });
}));

/**
 * @route GET /api/water-quality/location/:locationId
 * @desc Get water quality data for a specific location
 * @access Public
 */
router.get('/location/:locationId', optionalAuth, asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const { days = 30 } = req.query;

  // Parse location ID (could be coordinates or a location identifier)
  let coordinates;
  try {
    coordinates = locationId.split(',').map(Number);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid location format'
    });
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const waterQualityData = await WaterQuality.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates[1], coordinates[0]] // [lon, lat]
        },
        $maxDistance: 1000 // 1km radius
      }
    },
    timestamp: { $gte: startDate }
  })
  .sort({ timestamp: -1 })
  .populate('userId', 'firstName lastName username')
  .lean();

  // Calculate statistics
  const stats = calculateLocationStats(waterQualityData);

  res.json({
    success: true,
    data: {
      location: {
        coordinates,
        address: waterQualityData[0]?.location.address || {}
      },
      readings: waterQualityData,
      statistics: stats
    }
  });
}));

/**
 * @route GET /api/water-quality/statistics
 * @desc Get water quality statistics
 * @access Public
 */
router.get('/statistics/overview', optionalAuth, asyncHandler(async (req, res) => {
  const { lat, lon, radius = 10, days = 30 } = req.query;

  let query = {};

  if (lat && lon) {
    query.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(lon), parseFloat(lat)]
        },
        $maxDistance: parseFloat(radius) * 1000
      }
    };
  }

  if (days) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    query.timestamp = { $gte: startDate };
  }

  const stats = await WaterQuality.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalReadings: { $sum: 1 },
        avgQualityScore: { $avg: '$qualityScore' },
        minQualityScore: { $min: '$qualityScore' },
        maxQualityScore: { $max: '$qualityScore' },
        excellentCount: {
          $sum: { $cond: [{ $gte: ['$qualityScore', 80] }, 1, 0] }
        },
        goodCount: {
          $sum: { $cond: [{ $and: [{ $gte: ['$qualityScore', 60] }, { $lt: ['$qualityScore', 80] }] }, 1, 0] }
        },
        fairCount: {
          $sum: { $cond: [{ $and: [{ $gte: ['$qualityScore', 40] }, { $lt: ['$qualityScore', 60] }] }, 1, 0] }
        },
        poorCount: {
          $sum: { $cond: [{ $and: [{ $gte: ['$qualityScore', 20] }, { $lt: ['$qualityScore', 40] }] }, 1, 0] }
        },
        criticalCount: {
          $sum: { $cond: [{ $lt: ['$qualityScore', 20] }, 1, 0] }
        }
      }
    }
  ]);

  const sourceStats = await WaterQuality.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
        avgQualityScore: { $avg: '$qualityScore' }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      overview: stats[0] || {
        totalReadings: 0,
        avgQualityScore: 0,
        minQualityScore: 0,
        maxQualityScore: 0,
        excellentCount: 0,
        goodCount: 0,
        fairCount: 0,
        poorCount: 0,
        criticalCount: 0
      },
      bySource: sourceStats
    }
  });
}));

/**
 * @route GET /api/water-quality/alerts
 * @desc Get water quality alerts
 * @access Private
 */
router.get('/alerts', authMiddleware, asyncHandler(async (req, res) => {
  const { acknowledged, limit = 50, page = 1 } = req.query;

  let query = { 'alerts.isAlert': true };

  if (acknowledged !== undefined) {
    query['alerts.acknowledged'] = acknowledged === 'true';
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const alerts = await WaterQuality.find(query)
    .sort({ 'alerts.timestamp': -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('userId', 'firstName lastName username')
    .populate('alerts.acknowledgedBy', 'firstName lastName')
    .lean();

  const total = await WaterQuality.countDocuments(query);

  res.json({
    success: true,
    data: alerts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * @route PUT /api/water-quality/:id/acknowledge
 * @desc Acknowledge a water quality alert
 * @access Private
 */
router.put('/:id/acknowledge', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const waterQuality = await WaterQuality.findById(id);
  
  if (!waterQuality) {
    return res.status(404).json({
      success: false,
      message: 'Water quality record not found'
    });
  }

  if (!waterQuality.alerts.isAlert) {
    return res.status(400).json({
      success: false,
      message: 'No alert to acknowledge'
    });
  }

  waterQuality.alerts.acknowledged = true;
  waterQuality.alerts.acknowledgedBy = req.user.id;
  waterQuality.alerts.acknowledgedAt = new Date();

  await waterQuality.save();

  res.json({
    success: true,
    message: 'Alert acknowledged successfully'
  });
}));

/**
 * @route DELETE /api/water-quality/:id
 * @desc Delete water quality record (admin only)
 * @access Private (Admin)
 */
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  const waterQuality = await WaterQuality.findById(id);
  
  if (!waterQuality) {
    return res.status(404).json({
      success: false,
      message: 'Water quality record not found'
    });
  }

  await WaterQuality.findByIdAndDelete(id);

  logger.logSecurity('water_quality_deleted', {
    adminId: req.user.id,
    recordId: id,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Water quality record deleted successfully'
  });
}));

// Helper functions
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

function calculateLocationStats(data) {
  if (data.length === 0) {
    return {
      totalReadings: 0,
      avgQualityScore: 0,
      qualityDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
        critical: 0
      },
      recentTrend: 'stable'
    };
  }

  const qualityScores = data.map(item => item.qualityScore);
  const avgQualityScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;

  const qualityDistribution = {
    excellent: data.filter(item => item.qualityScore >= 80).length,
    good: data.filter(item => item.qualityScore >= 60 && item.qualityScore < 80).length,
    fair: data.filter(item => item.qualityScore >= 40 && item.qualityScore < 60).length,
    poor: data.filter(item => item.qualityScore >= 20 && item.qualityScore < 40).length,
    critical: data.filter(item => item.qualityScore < 20).length
  };

  // Calculate recent trend (last 10 readings vs previous 10)
  let recentTrend = 'stable';
  if (data.length >= 20) {
    const recentAvg = data.slice(0, 10).reduce((sum, item) => sum + item.qualityScore, 0) / 10;
    const previousAvg = data.slice(10, 20).reduce((sum, item) => sum + item.qualityScore, 0) / 10;
    
    if (recentAvg > previousAvg + 5) {
      recentTrend = 'improving';
    } else if (recentAvg < previousAvg - 5) {
      recentTrend = 'declining';
    }
  }

  return {
    totalReadings: data.length,
    avgQualityScore: Math.round(avgQualityScore * 100) / 100,
    qualityDistribution,
    recentTrend
  };
}

module.exports = router;
