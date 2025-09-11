const express = require('express');
const router = express.Router();
const User = require('../models/User');
const WaterQuality = require('../models/WaterQuality');
const ESP32Device = require('../models/ESP32Device');
const { logger } = require('../utils/logger');
const { adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route GET /api/admin/dashboard
 * @desc Get admin dashboard statistics
 * @access Private (Admin)
 */
router.get('/dashboard', adminOnly, asyncHandler(async (req, res) => {
  try {
    // Get system statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalWaterQualityRecords = await WaterQuality.countDocuments();
    const totalESP32Devices = await ESP32Device.countDocuments();
    const onlineDevices = await ESP32Device.countDocuments({ status: 'online' });

    // Get recent activity
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('firstName lastName email createdAt');

    const recentWaterQuality = await WaterQuality.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('userId', 'firstName lastName')
      .select('qualityScore source timestamp location');

    const recentAlerts = await WaterQuality.find({ 'alerts.isAlert': true })
      .sort({ 'alerts.timestamp': -1 })
      .limit(10)
      .populate('userId', 'firstName lastName')
      .select('qualityScore alerts location timestamp');

    // Get quality score distribution
    const qualityDistribution = await WaterQuality.aggregate([
      {
        $group: {
          _id: null,
          excellent: { $sum: { $cond: [{ $gte: ['$qualityScore', 80] }, 1, 0] } },
          good: { $sum: { $cond: [{ $and: [{ $gte: ['$qualityScore', 60] }, { $lt: ['$qualityScore', 80] }] }, 1, 0] } },
          fair: { $sum: { $cond: [{ $and: [{ $gte: ['$qualityScore', 40] }, { $lt: ['$qualityScore', 60] }] }, 1, 0] } },
          poor: { $sum: { $cond: [{ $and: [{ $gte: ['$qualityScore', 20] }, { $lt: ['$qualityScore', 40] }] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $lt: ['$qualityScore', 20] }, 1, 0] } }
        }
      }
    ]);

    // Get source distribution
    const sourceDistribution = await WaterQuality.aggregate([
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
        statistics: {
          totalUsers,
          activeUsers,
          totalWaterQualityRecords,
          totalESP32Devices,
          onlineDevices
        },
        recentActivity: {
          users: recentUsers,
          waterQuality: recentWaterQuality,
          alerts: recentAlerts
        },
        qualityDistribution: qualityDistribution[0] || {
          excellent: 0,
          good: 0,
          fair: 0,
          poor: 0,
          critical: 0
        },
        sourceDistribution
      }
    });
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data',
      error: error.message
    });
  }
}));

/**
 * @route GET /api/admin/users
 * @desc Get all users with pagination and filters
 * @access Private (Admin)
 */
router.get('/users', adminOnly, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    role,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  let query = {};

  // Search filter
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } }
    ];
  }

  // Role filter
  if (role) {
    query.role = role;
  }

  // Status filter
  if (status) {
    query.isActive = status === 'active';
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const users = await User.find(query)
    .select('-password -loginAttempts -lockUntil')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

/**
 * @route PUT /api/admin/users/:id
 * @desc Update user by admin
 * @access Private (Admin)
 */
router.put('/users/:id', adminOnly, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, isActive, isVerified } = req.body;

  const user = await User.findById(id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update allowed fields
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  if (isVerified !== undefined) user.isVerified = isVerified;

  await user.save();

  logger.logSecurity('user_updated_by_admin', {
    adminId: req.user.id,
    userId: id,
    changes: { role, isActive, isVerified }
  });

  res.json({
    success: true,
    message: 'User updated successfully',
    data: user.getPublicProfile()
  });
}));

/**
 * @route DELETE /api/admin/users/:id
 * @desc Delete user by admin
 * @access Private (Admin)
 */
router.delete('/users/:id', adminOnly, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Soft delete - mark as inactive
  user.isActive = false;
  await user.save();

  logger.logSecurity('user_deleted_by_admin', {
    adminId: req.user.id,
    userId: id
  });

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
}));

/**
 * @route GET /api/admin/water-quality
 * @desc Get water quality data with admin filters
 * @access Private (Admin)
 */
router.get('/water-quality', adminOnly, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    source,
    startDate,
    endDate,
    minQualityScore,
    maxQualityScore,
    sortBy = 'timestamp',
    sortOrder = 'desc'
  } = req.query;

  let query = {};

  // Source filter
  if (source) {
    query.source = source;
  }

  // Date filter
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  // Quality score filter
  if (minQualityScore || maxQualityScore) {
    query.qualityScore = {};
    if (minQualityScore) query.qualityScore.$gte = parseFloat(minQualityScore);
    if (maxQualityScore) query.qualityScore.$lte = parseFloat(maxQualityScore);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const waterQualityData = await WaterQuality.find(query)
    .populate('userId', 'firstName lastName username')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await WaterQuality.countDocuments(query);

  res.json({
    success: true,
    data: {
      waterQuality: waterQualityData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

/**
 * @route DELETE /api/admin/water-quality/:id
 * @desc Delete water quality record by admin
 * @access Private (Admin)
 */
router.delete('/water-quality/:id', adminOnly, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const waterQuality = await WaterQuality.findById(id);
  
  if (!waterQuality) {
    return res.status(404).json({
      success: false,
      message: 'Water quality record not found'
    });
  }

  await WaterQuality.findByIdAndDelete(id);

  logger.logSecurity('water_quality_deleted_by_admin', {
    adminId: req.user.id,
    recordId: id
  });

  res.json({
    success: true,
    message: 'Water quality record deleted successfully'
  });
}));

/**
 * @route GET /api/admin/esp32-devices
 * @desc Get all ESP32 devices with admin filters
 * @access Private (Admin)
 */
router.get('/esp32-devices', adminOnly, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    search,
    sortBy = 'lastSeen',
    sortOrder = 'desc'
  } = req.query;

  let query = {};

  // Status filter
  if (status) {
    query.status = status;
  }

  // Search filter
  if (search) {
    query.$or = [
      { deviceId: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const devices = await ESP32Device.find(query)
    .select('-configuration.wifiPassword')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await ESP32Device.countDocuments(query);

  res.json({
    success: true,
    data: {
      devices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

/**
 * @route PUT /api/admin/esp32-devices/:id
 * @desc Update ESP32 device by admin
 * @access Private (Admin)
 */
router.put('/esp32-devices/:id', adminOnly, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const device = await ESP32Device.findById(id);
  
  if (!device) {
    return res.status(404).json({
      success: false,
      message: 'Device not found'
    });
  }

  // Update device
  Object.assign(device, updateData);
  await device.save();

  logger.logSecurity('esp32_device_updated_by_admin', {
    adminId: req.user.id,
    deviceId: id,
    changes: updateData
  });

  res.json({
    success: true,
    message: 'Device updated successfully',
    data: device
  });
}));

/**
 * @route DELETE /api/admin/esp32-devices/:id
 * @desc Delete ESP32 device by admin
 * @access Private (Admin)
 */
router.delete('/esp32-devices/:id', adminOnly, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const device = await ESP32Device.findById(id);
  
  if (!device) {
    return res.status(404).json({
      success: false,
      message: 'Device not found'
    });
  }

  await ESP32Device.findByIdAndDelete(id);

  logger.logSecurity('esp32_device_deleted_by_admin', {
    adminId: req.user.id,
    deviceId: id
  });

  res.json({
    success: true,
    message: 'Device deleted successfully'
  });
}));

/**
 * @route GET /api/admin/alerts
 * @desc Get all alerts with admin filters
 * @access Private (Admin)
 */
router.get('/alerts', adminOnly, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    acknowledged,
    alertType,
    startDate,
    endDate,
    sortBy = 'timestamp',
    sortOrder = 'desc'
  } = req.query;

  let query = { 'alerts.isAlert': true };

  // Acknowledged filter
  if (acknowledged !== undefined) {
    query['alerts.acknowledged'] = acknowledged === 'true';
  }

  // Alert type filter
  if (alertType) {
    query['alerts.alertType'] = alertType;
  }

  // Date filter
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const alerts = await WaterQuality.find(query)
    .populate('userId', 'firstName lastName username')
    .populate('alerts.acknowledgedBy', 'firstName lastName')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await WaterQuality.countDocuments(query);

  res.json({
    success: true,
    data: {
      alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

/**
 * @route PUT /api/admin/alerts/:id/acknowledge
 * @desc Acknowledge alert by admin
 * @access Private (Admin)
 */
router.put('/alerts/:id/acknowledge', adminOnly, asyncHandler(async (req, res) => {
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

  logger.logSecurity('alert_acknowledged_by_admin', {
    adminId: req.user.id,
    recordId: id
  });

  res.json({
    success: true,
    message: 'Alert acknowledged successfully'
  });
}));

/**
 * @route GET /api/admin/system-stats
 * @desc Get system statistics for admin
 * @access Private (Admin)
 */
router.get('/system-stats', adminOnly, asyncHandler(async (req, res) => {
  try {
    // Get various system statistics
    const stats = {
      users: {
        total: await User.countDocuments(),
        active: await User.countDocuments({ isActive: true }),
        verified: await User.countDocuments({ isVerified: true }),
        byRole: await User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ])
      },
      waterQuality: {
        total: await WaterQuality.countDocuments(),
        bySource: await WaterQuality.aggregate([
          { $group: { _id: '$source', count: { $sum: 1 } } }
        ]),
        byStatus: await WaterQuality.aggregate([
          { $group: { _id: '$assessment.status', count: { $sum: 1 } } }
        ]),
        alerts: await WaterQuality.countDocuments({ 'alerts.isAlert': true })
      },
      devices: {
        total: await ESP32Device.countDocuments(),
        online: await ESP32Device.countDocuments({ status: 'online' }),
        offline: await ESP32Device.countDocuments({ status: 'offline' }),
        maintenance: await ESP32Device.countDocuments({ status: 'maintenance' })
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('System stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system statistics',
      error: error.message
    });
  }
}));

/**
 * @route POST /api/admin/broadcast
 * @desc Send broadcast message to all users
 * @access Private (Admin)
 */
router.post('/broadcast', adminOnly, asyncHandler(async (req, res) => {
  const { subject, message, type = 'email' } = req.body;

  if (!subject || !message) {
    return res.status(400).json({
      success: false,
      message: 'Subject and message are required'
    });
  }

  try {
    // Get all active users
    const users = await User.find({ isActive: true })
      .select('email phone firstName lastName preferences');

    const results = {
      email: { sent: 0, failed: 0 },
      sms: { sent: 0, failed: 0 },
      push: { sent: 0, failed: 0 }
    };

    for (const user of users) {
      try {
        switch (type) {
          case 'email':
            if (user.preferences?.notifications?.email && user.email) {
              // Send email using notification service
              await require('../routes/notifications').sendEmail(
                user.email, 
                subject, 
                message, 
                { broadcast: true }
              );
              results.email.sent++;
            }
            break;

          case 'sms':
            if (user.preferences?.notifications?.sms && user.phone) {
              // Send SMS using notification service
              await require('../routes/notifications').sendSMS(
                user.phone, 
                message, 
                { broadcast: true }
              );
              results.sms.sent++;
            }
            break;

          case 'push':
            if (user.preferences?.notifications?.push) {
              // Send push notification
              await require('../routes/notifications').sendPushNotification(
                user._id, 
                subject, 
                message, 
                { broadcast: true }
              );
              results.push.sent++;
            }
            break;

          case 'all':
            // Send to all enabled methods
            if (user.preferences?.notifications?.email && user.email) {
              await require('../routes/notifications').sendEmail(
                user.email, 
                subject, 
                message, 
                { broadcast: true }
              );
              results.email.sent++;
            }
            if (user.preferences?.notifications?.sms && user.phone) {
              await require('../routes/notifications').sendSMS(
                user.phone, 
                message, 
                { broadcast: true }
              );
              results.sms.sent++;
            }
            if (user.preferences?.notifications?.push) {
              await require('../routes/notifications').sendPushNotification(
                user._id, 
                subject, 
                message, 
                { broadcast: true }
              );
              results.push.sent++;
            }
            break;
        }
      } catch (error) {
        logger.error('Broadcast notification error:', error);
        results[type].failed++;
      }
    }

    logger.logSecurity('broadcast_sent_by_admin', {
      adminId: req.user.id,
      type,
      recipients: users.length,
      results
    });

    res.json({
      success: true,
      message: 'Broadcast sent successfully',
      data: {
        recipients: users.length,
        results
      }
    });

  } catch (error) {
    logger.error('Broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send broadcast',
      error: error.message
    });
  }
}));

module.exports = router;
