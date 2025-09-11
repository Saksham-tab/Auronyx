const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const DirectLLMClient = require('../services/directLLMClient');
const NodeLLMClient = require('../services/nodeLLMClient');

// Initialize clients
const directLLM = new DirectLLMClient();
const nodeLLM = new NodeLLMClient();

// Optimized Python LLM call with Node.js fallback
const callPythonLLM = async ({ message, context, location }) => {
  try {
    return await directLLM.chat({ message, context, location });
  } catch (error) {
    logger.warn('Direct Python LLM failed, using Node.js LLM client:', error.message);
    
    // Build enhanced prompt with context
    let enhancedMessage = message;
    if (context) enhancedMessage = `Context: ${context}\n\n${enhancedMessage}`;
    if (location?.address) enhancedMessage = `Location: ${location.address}\n\n${enhancedMessage}`;
    
    const response = await nodeLLM.generateResponse(enhancedMessage);
    return {
      success: true,
      data: { response }
    };
  }
};

/**
 * POST /api/ai-enhanced/chatbot/chat
 */
router.post('/chatbot/chat', optionalAuth, asyncHandler(async (req, res) => {
  const { message, context, location } = req.body;

  // Validate input
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Message is required and must be a non-empty string' 
    });
  }

  try {
    // Call Python LLM directly
    const result = await callPythonLLM({ 
      message: message.trim(), 
      context, 
      location 
    });
    
    if (!result || result.success !== true) {
      throw new Error(result?.message || 'Direct Python LLM returned invalid response');
    }

    // Log interaction
    logger.info('Chatbot interaction:', {
      userId: req.user?.id || 'anonymous',
      message: message.substring(0, 100),
      hasLocation: !!location,
      hasContext: !!context,
      responseLength: String(result?.data?.response || '').length
    });

    // Return response
    res.json(result);
  } catch (error) {
    logger.error('Chatbot error:', error);
    
    // Return error response instead of hardcoded fallback
    return res.status(500).json({
      success: false,
      message: 'Failed to get AI response. Please try again later.',
      error: error.message
    });
  }
}));

/**
 * GET /api/ai-enhanced/chatbot/status
 */
router.get('/chatbot/status', asyncHandler(async (req, res) => {
  try {
    const health = await directLLM.health();
    res.json({ success: true, data: { ...health, directLLM: true } });
  } catch (e) {
    res.status(503).json({ success: false, message: 'Direct Python LLM not available' });
  }
}));

module.exports = router;