const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const WaterQuality = require('../models/WaterQuality');
const { logger } = require('../utils/logger');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { spawn } = require('child_process');
const path = require('path');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * @route POST /api/ai/analyzeno
 * @desc Analyze water quality data using AI
 * @access Private
 */
router.post('/analyze', authMiddleware, asyncHandler(async (req, res) => {
  const { location, sensorData, reviewData, weatherData } = req.body;

  if (!location || (!sensorData && !reviewData)) {
    return res.status(400).json({
      success: false,
      message: 'Location and either sensor data or review data are required'
    });
  }

  try {
    // Prepare data for AI analysis
    const analysisData = {
      location: location.address || `${location.coordinates[0]}, ${location.coordinates[1]}`,
      timestamp: new Date().toISOString(),
      weather: weatherData || {},
      sensors: sensorData || {},
      review: reviewData || {}
    };

    // Create AI prompt
    const prompt = createAnalysisPrompt(analysisData);

    // Get AI analysis
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a water quality expert and environmental scientist. Analyze the provided data and give comprehensive insights about water quality, potential health risks, and recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    const analysis = completion.choices[0].message.content;

    // Parse AI response
    const parsedAnalysis = parseAIAnalysis(analysis);

    logger.logAPI(req, res, Date.now());

    res.json({
      success: true,
      data: {
        analysis: parsedAnalysis,
        rawAnalysis: analysis,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('AI analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze data',
      error: error.message
    });
  }
}));

/**
 * @route GET /api/ai/summary/:locationId
 * @desc Get AI summary for a location
 * @access Public
 */
router.get('/summary/:locationId', optionalAuth, asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const { days = 30 } = req.query;

  // Parse location ID (coordinates)
  let coordinates;
  try {
    coordinates = locationId.split(',').map(Number);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid location format'
    });
  }

  // Get water quality data for the location
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
  .populate('userId', 'firstName lastName')
  .lean();

  if (waterQualityData.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No water quality data found for this location'
    });
  }

  try {
    // Prepare summary data
    const summaryData = prepareSummaryData(waterQualityData, coordinates);

    // Create AI prompt for summary
    const prompt = createSummaryPrompt(summaryData);

    // Get AI summary
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a water quality expert. Provide a comprehensive summary of water quality trends, community insights, and recommendations based on the provided data."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.3
    });

    const summary = completion.choices[0].message.content;

    // Parse AI response
    const parsedSummary = parseAISummary(summary);

    res.json({
      success: true,
      data: {
        location: {
          coordinates,
          address: waterQualityData[0]?.location.address || {}
        },
        summary: parsedSummary,
        rawSummary: summary,
        dataPoints: waterQualityData.length,
        timeRange: `${days} days`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('AI summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate summary',
      error: error.message
    });
  }
}));

/**
 * @route POST /api/ai/recommendations
 * @desc Get AI-powered recommendations
 * @access Private
 */
router.post('/recommendations', authMiddleware, asyncHandler(async (req, res) => {
  const { location, qualityScore, issues, userPreferences } = req.body;

  if (!location || qualityScore === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Location and quality score are required'
    });
  }

  try {
    // Create recommendations prompt
    const prompt = createRecommendationsPrompt({
      location: location.address || `${location.coordinates[0]}, ${location.coordinates[1]}`,
      qualityScore,
      issues: issues || [],
      preferences: userPreferences || {}
    });

    // Get AI recommendations
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a water quality expert and environmental consultant. Provide practical, actionable recommendations for improving water quality and addressing specific issues."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.4
    });

    const recommendations = completion.choices[0].message.content;

    // Parse AI response
    const parsedRecommendations = parseAIRecommendations(recommendations);

    res.json({
      success: true,
      data: {
        recommendations: parsedRecommendations,
        rawRecommendations: recommendations,
        qualityScore,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('AI recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations',
      error: error.message
    });
  }
}));

/**
 * @route POST /api/ai/chat
 * @desc AI chatbot for water quality questions
 * @access Public
 */
router.post('/chat', optionalAuth, asyncHandler(async (req, res) => {
  const { message, context, location } = req.body;

  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'Message is required'
    });
  }

  try {
    // Create chat prompt
    const prompt = createChatPrompt(message, context, location);

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful water quality expert assistant. Provide accurate, informative, and friendly responses about water quality, environmental issues, and health concerns. Always prioritize safety and recommend consulting professionals for serious health issues."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const response = completion.choices[0].message.content;

    res.json({
      success: true,
      data: {
        response,
        timestamp: new Date().toISOString(),
        userId: req.user?.id || 'anonymous'
      }
    });

  } catch (error) {
    logger.error('AI chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get response',
      error: error.message
    });
  }
}));

/**
 * @route GET /api/ai/trends/:locationId
 * @desc Get AI analysis of water quality trends
 * @access Public
 */
router.get('/trends/:locationId', optionalAuth, asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const { days = 90 } = req.query;

  // Parse location ID (coordinates)
  let coordinates;
  try {
    coordinates = locationId.split(',').map(Number);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid location format'
    });
  }

  // Get water quality data for trend analysis
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const waterQualityData = await WaterQuality.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates[1], coordinates[0]]
        },
        $maxDistance: 1000
      }
    },
    timestamp: { $gte: startDate }
  })
  .sort({ timestamp: 1 })
  .lean();

  if (waterQualityData.length < 5) {
    return res.status(404).json({
      success: false,
      message: 'Insufficient data for trend analysis'
    });
  }

  try {
    // Prepare trend data
    const trendData = prepareTrendData(waterQualityData);

    // Create AI prompt for trend analysis
    const prompt = createTrendPrompt(trendData);

    // Get AI trend analysis
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a water quality expert and data analyst. Analyze the provided trend data and identify patterns, potential causes, and future predictions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.3
    });

    const trendAnalysis = completion.choices[0].message.content;

    // Parse AI response
    const parsedTrends = parseAITrends(trendAnalysis);

    res.json({
      success: true,
      data: {
        location: {
          coordinates,
          address: waterQualityData[0]?.location.address || {}
        },
        trends: parsedTrends,
        rawAnalysis: trendAnalysis,
        dataPoints: waterQualityData.length,
        timeRange: `${days} days`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('AI trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze trends',
      error: error.message
    });
  }
}));

/**
 * @route POST /api/ai/analyze-location
 * @desc Analyze water quality using Python LLM with MongoDB reviews
 * @access Public
 */
router.post('/analyze-location', asyncHandler(async (req, res) => {
  try {
    const { location } = req.body;

    if (!location) {
      return res.status(400).json({
        success: false,
        message: 'Location is required'
      });
    }

    // Path to the Python script
    const pythonScriptPath = path.join(__dirname, '../models/ai/llm_main.py');
    
    // Spawn Python process with location as command line argument
    // Use full path to Python executable to ensure we get the correct environment
    const pythonExecutable = 'C:\\Users\\ms\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';
    const pythonProcess = spawn(pythonExecutable, [pythonScriptPath, location], {
      cwd: path.dirname(pythonScriptPath),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';
    let processCompleted = false;

    // Set timeout for Python process (30 seconds)
    const timeout = setTimeout(() => {
      if (!processCompleted) {
        pythonProcess.kill('SIGTERM');
        return res.status(500).json({
          success: false,
          message: 'AI analysis timed out',
          error: 'Python process exceeded 30 second timeout'
        });
      }
    }, 30000);

    // Collect output
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      processCompleted = true;
      clearTimeout(timeout);
      
      if (code !== 0) {
        console.error('Python script error:', errorOutput);
        return res.status(500).json({
          success: false,
          message: 'AI analysis failed',
          error: errorOutput
        });
      }

      try {
        // Clean and parse JSON output from Python script
        const cleanOutput = output.trim();
        if (!cleanOutput) {
          throw new Error('Empty output from Python script');
        }

        // Extract the JSON substring in case any non-JSON logs leaked into stdout
        const startIdx = cleanOutput.indexOf('{');
        const endIdx = cleanOutput.lastIndexOf('}');
        if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
          throw new Error('No JSON object found in Python output');
        }
        const jsonSlice = cleanOutput.slice(startIdx, endIdx + 1);

        let pythonResult;
        try {
          pythonResult = JSON.parse(jsonSlice);
        } catch (inner) {
          // Log the first 500 chars for debugging then rethrow
          throw new Error(`Invalid JSON from Python (${inner.message})`);
        }
        
        // Validate required fields
        if (!pythonResult.location || typeof pythonResult.safe_percentage !== 'number' || !pythonResult.analysis) {
          throw new Error('Invalid data structure from Python script');
        }
        
        res.json({
          success: true,
          data: {
            location: pythonResult.location,
            safe_percentage: pythonResult.safe_percentage,
            analysis: pythonResult.analysis,
            summary: pythonResult.summary,
            review_count: pythonResult.review_count || 0,
            sentiment_stats: pythonResult.sentiment_stats || {}
          }
        });

      } catch (parseError) {
        console.error('Error parsing Python output:', parseError);
        console.log('Raw output:', output);
        if (errorOutput) {
          console.log('Stderr output:', errorOutput);
        }
        res.status(500).json({
          success: false,
          message: 'Error parsing AI analysis results',
          error: parseError.message,
          raw_output: output.substring(0, 1000) // Limit output size
        });
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start AI analysis process',
        error: error.message
      });
    });

  } catch (error) {
    console.error('AI Analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}));

// Helper functions
function createAnalysisPrompt(data) {
  return `
Analyze the following water quality data and provide insights:

Location: ${data.location}
Timestamp: ${data.timestamp}

Weather Conditions:
${JSON.stringify(data.weather, null, 2)}

Sensor Data:
${JSON.stringify(data.sensors, null, 2)}

Review Data:
${JSON.stringify(data.review, null, 2)}

Please provide:
1. Overall water quality assessment
2. Potential health risks
3. Environmental factors affecting water quality
4. Recommendations for improvement
5. Safety recommendations for users

Format your response as JSON with the following structure:
{
  "assessment": "overall assessment",
  "healthRisks": ["risk1", "risk2"],
  "environmentalFactors": ["factor1", "factor2"],
  "recommendations": ["rec1", "rec2"],
  "safetyAdvice": ["advice1", "advice2"],
  "confidence": "high/medium/low"
}
`;
}

function createSummaryPrompt(data) {
  return `
Analyze the following water quality data summary and provide insights:

Location: ${data.location}
Time Period: ${data.timeRange}
Total Data Points: ${data.totalPoints}

Quality Score Statistics:
- Average: ${data.avgQualityScore}
- Range: ${data.minQualityScore} - ${data.maxQualityScore}
- Trend: ${data.trend}

Community Reviews:
- Average Rating: ${data.avgRating}
- Total Reviews: ${data.totalReviews}
- Common Issues: ${data.commonIssues.join(', ')}

Recent Alerts: ${data.alerts.length}

Please provide:
1. Overall summary of water quality in this area
2. Key trends and patterns
3. Community concerns and feedback
4. Recommendations for residents
5. Environmental impact assessment

Format your response as JSON with the following structure:
{
  "summary": "overall summary",
  "trends": ["trend1", "trend2"],
  "communityInsights": ["insight1", "insight2"],
  "recommendations": ["rec1", "rec2"],
  "environmentalImpact": "impact assessment"
}
`;
}

function createRecommendationsPrompt(data) {
  return `
Provide recommendations for water quality improvement:

Location: ${data.location}
Current Quality Score: ${data.qualityScore}/100
Identified Issues: ${data.issues.join(', ')}
User Preferences: ${JSON.stringify(data.preferences)}

Please provide:
1. Immediate actions to take
2. Long-term improvement strategies
3. Equipment and technology recommendations
4. Community engagement suggestions
5. Monitoring and maintenance advice

Format your response as JSON with the following structure:
{
  "immediateActions": ["action1", "action2"],
  "longTermStrategies": ["strategy1", "strategy2"],
  "equipmentRecommendations": ["equipment1", "equipment2"],
  "communityEngagement": ["engagement1", "engagement2"],
  "monitoringAdvice": ["advice1", "advice2"],
  "priority": "high/medium/low"
}
`;
}

function createChatPrompt(message, context, location) {
  return `
User Question: ${message}

Context: ${context || 'No specific context provided'}

Location: ${location ? JSON.stringify(location) : 'No specific location'}

Please provide a helpful, informative response about water quality, environmental issues, or health concerns. Be friendly and professional, and always prioritize safety.
`;
}

function createTrendPrompt(data) {
  return `
Analyze the following water quality trend data:

Location: ${data.location}
Time Period: ${data.timeRange}
Data Points: ${data.dataPoints}

Quality Score Trends:
${JSON.stringify(data.qualityTrends, null, 2)}

Sensor Data Trends:
${JSON.stringify(data.sensorTrends, null, 2)}

Weather Correlation:
${JSON.stringify(data.weatherCorrelation, null, 2)}

Please provide:
1. Trend analysis and patterns
2. Potential causes for changes
3. Seasonal variations
4. Future predictions
5. Recommendations based on trends

Format your response as JSON with the following structure:
{
  "trendAnalysis": "overall trend analysis",
  "patterns": ["pattern1", "pattern2"],
  "causes": ["cause1", "cause2"],
  "seasonalVariations": "seasonal analysis",
  "predictions": ["prediction1", "prediction2"],
  "recommendations": ["rec1", "rec2"]
}
`;
}

function prepareSummaryData(waterQualityData, coordinates) {
  const qualityScores = waterQualityData.map(item => item.qualityScore);
  const reviews = waterQualityData.filter(item => item.reviewData);
  
  // Calculate statistics
  const avgQualityScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
  const minQualityScore = Math.min(...qualityScores);
  const maxQualityScore = Math.max(...qualityScores);
  
  // Determine trend
  const recentScores = qualityScores.slice(0, Math.floor(qualityScores.length / 3));
  const olderScores = qualityScores.slice(-Math.floor(qualityScores.length / 3));
  const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
  const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;
  
  let trend = 'stable';
  if (recentAvg > olderAvg + 5) trend = 'improving';
  else if (recentAvg < olderAvg - 5) trend = 'declining';

  // Extract review data
  const avgRating = reviews.length > 0 ? 
    reviews.reduce((sum, item) => sum + item.reviewData.overallRating, 0) / reviews.length : 0;
  
  const commonIssues = [];
  reviews.forEach(item => {
    if (item.reviewData.healthEffects) {
      commonIssues.push(...item.reviewData.healthEffects);
    }
  });

  // Get alerts
  const alerts = waterQualityData.filter(item => item.alerts?.isAlert);

  return {
    location: `${coordinates[0]}, ${coordinates[1]}`,
    timeRange: `${Math.ceil(waterQualityData.length / 30)} days`,
    totalPoints: waterQualityData.length,
    avgQualityScore: Math.round(avgQualityScore * 100) / 100,
    minQualityScore,
    maxQualityScore,
    trend,
    avgRating: Math.round(avgRating * 100) / 100,
    totalReviews: reviews.length,
    commonIssues: [...new Set(commonIssues)],
    alerts: alerts.length
  };
}

function prepareTrendData(waterQualityData) {
  const qualityTrends = waterQualityData.map(item => ({
    date: item.timestamp,
    score: item.qualityScore
  }));

  const sensorTrends = {};
  const weatherCorrelation = {};

  // Extract sensor data trends
  waterQualityData.forEach(item => {
    if (item.sensorData) {
      Object.keys(item.sensorData).forEach(sensor => {
        if (!sensorTrends[sensor]) {
          sensorTrends[sensor] = [];
        }
        sensorTrends[sensor].push({
          date: item.timestamp,
          value: item.sensorData[sensor].value
        });
      });
    }

    if (item.weatherConditions) {
      weatherCorrelation[item.timestamp] = {
        temperature: item.weatherConditions.temperature,
        rainfall: item.weatherConditions.rainfall?.amount || 0,
        humidity: item.weatherConditions.humidity
      };
    }
  });

  return {
    location: `${waterQualityData[0]?.location.coordinates[0]}, ${waterQualityData[0]?.location.coordinates[1]}`,
    timeRange: `${Math.ceil(waterQualityData.length / 30)} days`,
    dataPoints: waterQualityData.length,
    qualityTrends,
    sensorTrends,
    weatherCorrelation
  };
}

function parseAIAnalysis(response) {
  try {
    return JSON.parse(response);
  } catch (error) {
    // Fallback parsing for non-JSON responses
    return {
      assessment: response,
      healthRisks: [],
      environmentalFactors: [],
      recommendations: [],
      safetyAdvice: [],
      confidence: 'medium'
    };
  }
}

function parseAISummary(response) {
  try {
    return JSON.parse(response);
  } catch (error) {
    return {
      summary: response,
      trends: [],
      communityInsights: [],
      recommendations: [],
      environmentalImpact: 'Unable to parse'
    };
  }
}

function parseAIRecommendations(response) {
  try {
    return JSON.parse(response);
  } catch (error) {
    return {
      immediateActions: [],
      longTermStrategies: [],
      equipmentRecommendations: [],
      communityEngagement: [],
      monitoringAdvice: [],
      priority: 'medium'
    };
  }
}

function parseAITrends(response) {
  try {
    return JSON.parse(response);
  } catch (error) {
    return {
      trendAnalysis: response,
      patterns: [],
      causes: [],
      seasonalVariations: 'Unable to parse',
      predictions: [],
      recommendations: []
    };
  }
}

module.exports = router;
