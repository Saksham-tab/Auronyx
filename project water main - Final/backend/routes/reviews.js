const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateWaterQualityReview } = require('../middleware/validation');

/**
 * POST /api/reviews
 * Create a new water quality review
 * @access Public (no authentication required)
 */
router.post('/', asyncHandler(async (req, res) => {
  try {
    console.log('📝 Received review submission:', JSON.stringify(req.body, null, 2));
    
    const { location, reviewData } = req.body;

    // Validate required fields
    if (!location || !location.coordinates || !reviewData || !reviewData.overallRating) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: location.coordinates and reviewData.overallRating are required'
      });
    }

    // Build the document with the validated data
    const reviewDoc = {
      location: {
        type: 'Point',
        coordinates: location.coordinates,
        address: location.address || {}
      },
      reviewData: {
        overallRating: reviewData.overallRating,
        taste: reviewData.taste || {},
        clarity: reviewData.clarity || {},
        odor: reviewData.odor || {},
        healthEffects: reviewData.healthEffects || [],
        additionalComments: reviewData.additionalComments || '',
        images: reviewData.images || []
      },
      timestamp: new Date()
    };

    console.log('🔧 Creating review document:', JSON.stringify(reviewDoc, null, 2));
    console.log('📊 Database connection state:', require('mongoose').connection.readyState);
    console.log('📊 Collection name:', Review.collection.collectionName);

    const review = new Review(reviewDoc);
    console.log('✅ Review instance created');
    
    const saved = await review.save();
    console.log('✅ Review saved successfully with ID:', saved._id);
    console.log('📄 Saved to collection:', saved.collection.collectionName);

    res.status(201).json({
      success: true,
      message: 'Review saved successfully',
      data: saved
    });
  } catch (error) {
    console.error('❌ Error saving review:', error);
    if (error.name === 'ValidationError') {
      console.error('Validation errors:');
      Object.keys(error.errors).forEach(key => {
        console.error(`- ${key}: ${error.errors[key].message}`);
      });
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }
    throw error;
  }
}));

/**
 * GET /api/reviews
 * Get all reviews with optional filtering
 * @access Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const { lat, lon, radius = 10, limit = 50, page = 1 } = req.query;
  
  let query = {};
  
  // Add geospatial query if coordinates provided
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
  
  const reviews = await Review.find(query)
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));
    
  const total = await Review.countDocuments(query);
  
  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: reviews.length,
        totalReviews: total
      }
    }
  });
}));

/**
 * GET /api/reviews/:id
 * Get a specific review by ID
 * @access Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
    
  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found'
    });
  }
  
  res.json({
    success: true,
    data: review
  });
}));

module.exports = router;
