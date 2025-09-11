/**
 * Response handler middleware to ensure all responses are JSON formatted
 */

/**
 * Middleware to ensure all responses have proper JSON headers and format
 */
const ensureJsonResponse = (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  const originalSend = res.send;
  const originalEnd = res.end;

  // Override json method to ensure consistent format
  res.json = function(data) {
    // Set JSON content type
    res.setHeader('Content-Type', 'application/json');
    
    // Ensure data has success field if not already present
    if (typeof data === 'object' && data !== null && !data.hasOwnProperty('success')) {
      data = {
        success: res.statusCode < 400,
        data: data
      };
    }
    
    return originalJson.call(this, data);
  };

  // Override send method to convert non-JSON responses to JSON
  res.send = function(data) {
    // If data is already JSON or response is not successful, use original send
    if (res.getHeader('Content-Type')?.includes('application/json') || res.statusCode >= 400) {
      return originalSend.call(this, data);
    }
    
    // Convert non-JSON responses to JSON format
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      res.setHeader('Content-Type', 'application/json');
      return originalSend.call(this, JSON.stringify({
        success: res.statusCode < 400,
        data: data
      }));
    }
    
    return originalSend.call(this, data);
  };

  // Override end method to ensure JSON format for empty responses
  res.end = function(data) {
    if (!data && res.statusCode >= 200 && res.statusCode < 300) {
      res.setHeader('Content-Type', 'application/json');
      return originalEnd.call(this, JSON.stringify({
        success: true,
        message: 'Request completed successfully'
      }));
    }
    
    return originalEnd.call(this, data);
  };

  next();
};

/**
 * Middleware to handle uncaught exceptions and ensure JSON error responses
 */
const handleUncaughtErrors = (req, res, next) => {
  // Handle uncaught exceptions in this request
  const originalEmit = req.emit;
  req.emit = function(event, ...args) {
    if (event === 'error') {
      const error = args[0];
      console.error('Uncaught request error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
      }
      return;
    }
    return originalEmit.apply(this, [event, ...args]);
  };

  next();
};

module.exports = {
  ensureJsonResponse,
  handleUncaughtErrors
};
