const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logger } = require('../utils/logger');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request object
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password -loginAttempts -lockUntil');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    if (user.isLocked()) {
      return res.status(401).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed login attempts.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication failed.',
      error: error.message
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of allowed roles
 */
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

/**
 * Admin authorization middleware
 */
const adminOnly = authorizeRoles(['admin']);

/**
 * Admin or moderator authorization middleware
 */
const adminOrModerator = authorizeRoles(['admin', 'moderator']);

/**
 * Optional authentication middleware
 * Similar to authMiddleware but doesn't fail if no token is provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password -loginAttempts -lockUntil');
    
    if (user && user.isActive && !user.isLocked()) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

/**
 * Device authentication middleware
 * For ESP32 devices using API keys or device tokens
 */
const deviceAuth = async (req, res, next) => {
  try {
    const deviceToken = req.header('X-Device-Token');
    const apiKey = req.header('X-API-Key');
    
    if (!deviceToken && !apiKey) {
      return res.status(401).json({
        success: false,
        message: 'Device authentication required.'
      });
    }

    // Validate device token or API key
    // This would typically check against a device registry
    // For now, we'll use a simple validation
    
    if (deviceToken) {
      // Validate device token logic here
      req.deviceId = extractDeviceIdFromToken(deviceToken);
    } else if (apiKey) {
      // Validate API key logic here
      req.deviceId = extractDeviceIdFromApiKey(apiKey);
    }

    if (!req.deviceId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid device credentials.'
      });
    }

    next();
  } catch (error) {
    logger.error('Device authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Device authentication failed.',
      error: error.message
    });
  }
};

// Helper functions for device authentication
function extractDeviceIdFromToken(token) {
  try {
    // Simple token validation - in production, use proper JWT or similar
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const deviceData = JSON.parse(decoded);
    return deviceData.deviceId;
  } catch (error) {
    return null;
  }
}

function extractDeviceIdFromApiKey(apiKey) {
  try {
    // Simple API key validation - in production, use proper validation
    const decoded = Buffer.from(apiKey, 'base64').toString('utf-8');
    const keyData = JSON.parse(decoded);
    return keyData.deviceId;
  } catch (error) {
    return null;
  }
}

module.exports = {
  authMiddleware,
  authorizeRoles,
  adminOnly,
  adminOrModerator,
  optionalAuth,
  deviceAuth
};
