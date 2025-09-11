const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const User = require('../models/User');
const Alert = require('../models/Alert');
const { logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Initialize Twilio client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ?
  twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

// Initialize email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * @route POST /api/notifications/send
 * @desc Send notification to users
 * @access Private
 */
router.post('/send', authMiddleware, asyncHandler(async (req, res) => {
  const { 
    type, 
    recipients, 
    subject, 
    message, 
    priority = 'normal',
    data = {} 
  } = req.body;

  if (!type || !recipients || !message) {
    return res.status(400).json({
      success: false,
      message: 'Type, recipients, and message are required'
    });
  }

  try {
    const results = {
      email: { sent: 0, failed: 0, errors: [] },
      sms: { sent: 0, failed: 0, errors: [] },
      push: { sent: 0, failed: 0, errors: [] }
    };

    // Get user details for recipients
    const users = await User.find({
      _id: { $in: recipients }
    }).select('email phone firstName lastName preferences');

    for (const user of users) {
      try {
        switch (type) {
          case 'email':
            if (user.preferences?.notifications?.email && user.email) {
              await sendEmail(user.email, subject, message, data);
              results.email.sent++;
            }
            break;

          case 'sms':
            if (user.preferences?.notifications?.sms && user.phone && twilioClient) {
              await sendSMS(user.phone, message, data);
              results.sms.sent++;
            }
            break;

          case 'push':
            if (user.preferences?.notifications?.push) {
              await sendPushNotification(user._id, subject, message, data);
              results.push.sent++;
            }
            break;

          case 'all':
            // Send to all enabled notification methods
            if (user.preferences?.notifications?.email && user.email) {
              await sendEmail(user.email, subject, message, data);
              results.email.sent++;
            }
            if (user.preferences?.notifications?.sms && user.phone && twilioClient) {
              await sendSMS(user.phone, message, data);
              results.sms.sent++;
            }
            if (user.preferences?.notifications?.push) {
              await sendPushNotification(user._id, subject, message, data);
              results.push.sent++;
            }
            break;

          default:
            throw new Error(`Unknown notification type: ${type}`);
        }
      } catch (error) {
        logger.error('Notification sending error:', error);
        results[type].failed++;
        results[type].errors.push({
          userId: user._id,
          error: error.message
        });
      }
    }

    logger.logAPI(req, res, Date.now());

    res.json({
      success: true,
      message: 'Notifications sent',
      data: results
    });

  } catch (error) {
    logger.error('Notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notifications',
      error: error.message
    });
  }
}));

/**
 * @route POST /api/notifications/water-quality-alert
 * @desc Send water quality alert notification
 * @access Private
 */
router.post('/water-quality-alert', authMiddleware, asyncHandler(async (req, res) => {
  const { 
    location, 
    qualityScore, 
    alerts, 
    severity = 'warning',
    recipients = [] 
  } = req.body;

  if (!location || qualityScore === undefined || !alerts) {
    return res.status(400).json({
      success: false,
      message: 'Location, quality score, and alerts are required'
    });
  }

  try {
    // Determine notification recipients
    let targetUsers = [];
    
    if (recipients.length > 0) {
      // Specific recipients
      targetUsers = await User.find({
        _id: { $in: recipients }
      }).select('email phone firstName lastName preferences');
    } else {
      // Find users near the location
      targetUsers = await User.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: location.coordinates
            },
            $maxDistance: 10000 // 10km radius
          }
        },
        'preferences.notifications.email': true
      }).select('email phone firstName lastName preferences');
    }

    // Create alert message
    const subject = `Water Quality Alert - ${severity.toUpperCase()}`;
    const message = createWaterQualityAlertMessage(location, qualityScore, alerts, severity);

    const results = {
      email: { sent: 0, failed: 0 },
      sms: { sent: 0, failed: 0 },
      push: { sent: 0, failed: 0 }
    };

    for (const user of targetUsers) {
      try {
        // Send email notification
        if (user.preferences?.notifications?.email && user.email) {
          await sendEmail(user.email, subject, message, {
            location,
            qualityScore,
            alerts,
            severity
          });
          results.email.sent++;
        }

        // Send SMS for critical alerts
        if (severity === 'critical' && user.preferences?.notifications?.sms && user.phone && twilioClient) {
          const smsMessage = `🚨 CRITICAL: Water quality alert in your area. Score: ${qualityScore}/100. Check app for details.`;
          await sendSMS(user.phone, smsMessage, { severity: 'critical' });
          results.sms.sent++;
        }

        // Send push notification
        if (user.preferences?.notifications?.push) {
          await sendPushNotification(user._id, subject, message, {
            location,
            qualityScore,
            alerts,
            severity
          });
          results.push.sent++;
        }
      } catch (error) {
        logger.error('Alert notification error:', error);
        results.email.failed++;
      }
    }

    res.json({
      success: true,
      message: 'Water quality alert notifications sent',
      data: {
        recipients: targetUsers.length,
        results
      }
    });

  } catch (error) {
    logger.error('Water quality alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send water quality alert',
      error: error.message
    });
  }
}));

/**
 * @route POST /api/notifications/weather-alert
 * @desc Send weather-related alert notification
 * @access Private
 */
router.post('/weather-alert', authMiddleware, asyncHandler(async (req, res) => {
  const { 
    location, 
    weatherData, 
    alertType, 
    recipients = [] 
  } = req.body;

  if (!location || !weatherData || !alertType) {
    return res.status(400).json({
      success: false,
      message: 'Location, weather data, and alert type are required'
    });
  }

  try {
    // Determine notification recipients
    let targetUsers = [];
    
    if (recipients.length > 0) {
      targetUsers = await User.find({
        _id: { $in: recipients }
      }).select('email phone firstName lastName preferences');
    } else {
      targetUsers = await User.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: location.coordinates
            },
            $maxDistance: 10000
          }
        },
        'preferences.notifications.email': true
      }).select('email phone firstName lastName preferences');
    }

    // Create weather alert message
    const subject = `Weather Alert - ${alertType.toUpperCase()}`;
    const message = createWeatherAlertMessage(location, weatherData, alertType);

    const results = {
      email: { sent: 0, failed: 0 },
      sms: { sent: 0, failed: 0 },
      push: { sent: 0, failed: 0 }
    };

    for (const user of targetUsers) {
      try {
        // Send email notification
        if (user.preferences?.notifications?.email && user.email) {
          await sendEmail(user.email, subject, message, {
            location,
            weatherData,
            alertType
          });
          results.email.sent++;
        }

        // Send SMS for severe weather
        if (alertType === 'severe' && user.preferences?.notifications?.sms && user.phone && twilioClient) {
          const smsMessage = `🌧️ WEATHER ALERT: Severe weather conditions in your area. Check app for details.`;
          await sendSMS(user.phone, smsMessage, { alertType: 'severe' });
          results.sms.sent++;
        }

        // Send push notification
        if (user.preferences?.notifications?.push) {
          await sendPushNotification(user._id, subject, message, {
            location,
            weatherData,
            alertType
          });
          results.push.sent++;
        }
      } catch (error) {
        logger.error('Weather alert notification error:', error);
        results.email.failed++;
      }
    }

    await Alert.create({
      location,
      weatherData,
      alertType,
      recipients: targetUsers.map(u => u._id),
      message,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Weather alert notifications sent',
      data: {
        recipients: targetUsers.length,
        results
      }
    });

  } catch (error) {
    logger.error('Weather alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send weather alert',
      error: error.message
    });
  }
}));

/**
 * @route PUT /api/notifications/preferences
 * @desc Update user notification preferences
 * @access Private
 */
router.put('/preferences', authMiddleware, asyncHandler(async (req, res) => {
  const { email, sms, push } = req.body;

  const user = await User.findById(req.user.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update notification preferences
  if (email !== undefined) {
    user.preferences.notifications.email = email;
  }
  if (sms !== undefined) {
    user.preferences.notifications.sms = sms;
  }
  if (push !== undefined) {
    user.preferences.notifications.push = push;
  }

  await user.save();

  res.json({
    success: true,
    message: 'Notification preferences updated',
    data: user.preferences.notifications
  });
}));

/**
 * @route GET /api/notifications/preferences
 * @desc Get user notification preferences
 * @access Private
 */
router.get('/preferences', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('preferences.notifications');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: user.preferences.notifications
  });
}));

/**
 * @route POST /api/notifications/test
 * @desc Send test notification
 * @access Private
 */
router.post('/test', authMiddleware, asyncHandler(async (req, res) => {
  const { type = 'email' } = req.body;

  const user = await User.findById(req.user.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  try {
    const subject = 'Test Notification';
    const message = 'This is a test notification from the Water Quality Monitoring System.';

    switch (type) {
      case 'email':
        if (!user.email) {
          return res.status(400).json({
            success: false,
            message: 'User email not found'
          });
        }
        await sendEmail(user.email, subject, message, { test: true });
        break;

      case 'sms':
        if (!user.phone) {
          return res.status(400).json({
            success: false,
            message: 'User phone number not found'
          });
        }
        if (!twilioClient) {
          return res.status(400).json({
            success: false,
            message: 'SMS service not configured'
          });
        }
        await sendSMS(user.phone, message, { test: true });
        break;

      case 'push':
        await sendPushNotification(user._id, subject, message, { test: true });
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid notification type'
        });
    }

    res.json({
      success: true,
      message: `Test ${type} notification sent successfully`
    });

  } catch (error) {
    logger.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
}));

// Helper functions
async function sendEmail(to, subject, message, data = {}) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    html: createEmailTemplate(subject, message, data)
  };

  const result = await emailTransporter.sendMail(mailOptions);
  logger.logAPI(null, null, Date.now());
  return result;
}

async function sendSMS(to, message, data = {}) {
  if (!twilioClient) {
    throw new Error('SMS service not configured');
  }

  const result = await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to
  });

  logger.logAPI(null, null, Date.now());
  return result;
}

async function sendPushNotification(userId, title, message, data = {}) {
  // This would integrate with a push notification service like Firebase
  // For now, we'll just log the notification
  logger.info('Push notification', {
    userId,
    title,
    message,
    data,
    timestamp: new Date().toISOString()
  });

  // TODO: Implement actual push notification service
  return { success: true };
}

function createEmailTemplate(subject, message, data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f8f9fa; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .alert { padding: 15px; margin: 10px 0; border-radius: 5px; }
        .alert-warning { background-color: #fff3cd; border: 1px solid #ffeaa7; }
        .alert-danger { background-color: #f8d7da; border: 1px solid #f5c6cb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Water Quality Monitoring System</h1>
        </div>
        <div class="content">
          <h2>${subject}</h2>
          <p>${message}</p>
          ${data.location ? `<p><strong>Location:</strong> ${data.location.address || `${data.location.coordinates[0]}, ${data.location.coordinates[1]}`}</p>` : ''}
          ${data.qualityScore !== undefined ? `<p><strong>Quality Score:</strong> ${data.qualityScore}/100</p>` : ''}
          ${data.severity ? `<div class="alert alert-${data.severity === 'critical' ? 'danger' : 'warning'}">
            <strong>Severity:</strong> ${data.severity.toUpperCase()}
          </div>` : ''}
        </div>
        <div class="footer">
          <p>This is an automated notification from the Water Quality Monitoring System.</p>
          <p>Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function createWaterQualityAlertMessage(location, qualityScore, alerts, severity) {
  const locationStr = location.address ? 
    `${location.address.street}, ${location.address.city}` : 
    `${location.coordinates[0]}, ${location.coordinates[1]}`;

  let message = `Water quality alert for ${locationStr}. `;
  message += `Current quality score: ${qualityScore}/100. `;
  
  if (alerts && alerts.length > 0) {
    message += `Issues detected: ${alerts.map(alert => alert.message).join(', ')}. `;
  }

  message += severity === 'critical' ? 
    'CRITICAL: Immediate action required. Avoid using water for drinking or cooking.' :
    'Please take necessary precautions and check the app for detailed information.';

  return message;
}

function createWeatherAlertMessage(location, weatherData, alertType) {
  const locationStr = location.address ? 
    `${location.address.street}, ${location.address.city}` : 
    `${location.coordinates[0]}, ${location.coordinates[1]}`;

  let message = `Weather alert for ${locationStr}. `;
  
  switch (alertType) {
    case 'rain':
      message += `Heavy rainfall detected. This may affect water quality. `;
      break;
    case 'flood':
      message += `Flood warning issued. Water quality may be compromised. `;
      break;
    case 'severe':
      message += `Severe weather conditions detected. `;
      break;
    default:
      message += `Weather conditions may affect water quality. `;
  }

  message += 'Please check the app for updated water quality information and take necessary precautions.';

  return message;
}

module.exports = router;
