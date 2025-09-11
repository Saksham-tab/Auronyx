const { logger } = require('../utils/logger');

/**
 * Simple in-memory cache middleware
 * In production, this should be replaced with Redis or another caching solution
 */
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cacheMiddleware = (duration = CACHE_TTL) => {
  return (req, res, next) => {
    const key = `${req.method}:${req.originalUrl}`;
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < duration) {
      logger.info(`Cache hit for ${key}`);
      return res.json(cached.data);
    }
    
    // Store original res.json
    const originalJson = res.json;
    
    // Override res.json to cache the response
    res.json = function(data) {
      cache.set(key, {
        data,
        timestamp: Date.now()
      });
      
      // Clean up old cache entries
      cleanupCache();
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

const cleanupCache = () => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
};

const clearCache = (pattern) => {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
};

module.exports = {
  cacheMiddleware,
  clearCache
};
