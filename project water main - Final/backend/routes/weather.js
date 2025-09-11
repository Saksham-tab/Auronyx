const express = require('express');
const router = express.Router();
const axios = require('axios');
const { logger } = require('../utils/logger');
const { validateLocation } = require('../middleware/validation');
const { cacheMiddleware } = require('../middleware/cache');
const Rainfall = require('../models/Rainfall');

// Weather API configurations
const WEATHER_APIS = {
  openweather: {
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    apiKey: process.env.OPENWEATHER_API_KEY
  },
  weatherapi: {
    baseUrl: 'http://api.weatherapi.com/v1',
    apiKey: process.env.WEATHERAPI_KEY
  },
  accuweather: {
    baseUrl: 'http://dataservice.accuweather.com',
    apiKey: process.env.ACCUWEATHER_API_KEY
  }
};

/**
 * @route GET /api/weather/current
 * @desc Get current weather conditions for a location
 * @access Public
 */
router.get('/current', validateLocation, cacheMiddleware(300), async (req, res) => {
  try {
    const { lat, lon, city, country } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // Try multiple weather APIs for redundancy
    const weatherData = await getWeatherFromMultipleSources(lat, lon, city, country);
    
    res.json({
      success: true,
      data: weatherData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Weather API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weather data',
      error: error.message
    });
  }
});

/**
 * @route GET /api/weather/rain-detection
 * @desc Check for rain detection and rainfall data
 * @access Public
 */
router.get('/rain-detection', validateLocation, cacheMiddleware(180), async (req, res) => {
  try {
    const { lat, lon, city, country } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const rainData = await getRainDetectionData(lat, lon, city, country);
    
    await Rainfall.create({
      location: {
        type: 'Point',
        coordinates: [parseFloat(lon), parseFloat(lat)],
        address: { city, country }
      },
      rainfallData: rainData,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: rainData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Rain detection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rain detection data',
      error: error.message
    });
  }
});

/**
 * @route GET /api/weather/forecast
 * @desc Get weather forecast for a location
 * @access Public
 */
router.get('/forecast', validateLocation, cacheMiddleware(1800), async (req, res) => {
  try {
    const { lat, lon, days = 5, city, country } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const forecastData = await getWeatherForecast(lat, lon, parseInt(days), city, country);
    
    res.json({
      success: true,
      data: forecastData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Weather forecast error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weather forecast',
      error: error.message
    });
  }
});

/**
 * @route GET /api/weather/rainfall-history
 * @desc Get historical rainfall data
 * @access Public
 */
router.get('/rainfall-history', validateLocation, cacheMiddleware(3600), async (req, res) => {
  try {
    const { lat, lon, days = 7, city, country } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const rainfallHistory = await getRainfallHistory(lat, lon, parseInt(days), city, country);
    
    await Rainfall.create({
      location: {
        type: 'Point',
        coordinates: [parseFloat(lon), parseFloat(lat)],
        address: { city, country }
      },
      rainfallData: rainfallHistory,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: rainfallHistory,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Rainfall history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rainfall history',
      error: error.message
    });
  }
});

/**
 * @route POST /api/weather/alert
 * @desc Set up weather alerts for a location
 * @access Private
 */
router.post('/alert', async (req, res) => {
  try {
    const { lat, lon, alertTypes, threshold, notificationMethod } = req.body;
    
    // Implementation for setting up weather alerts
    // This would integrate with notification system
    
    res.json({
      success: true,
      message: 'Weather alert configured successfully'
    });
  } catch (error) {
    logger.error('Weather alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to configure weather alert',
      error: error.message
    });
  }
});

// Helper functions
async function getWeatherFromMultipleSources(lat, lon, city, country) {
  const results = {};
  const errors = [];

  // Try OpenWeatherMap first
  if (WEATHER_APIS.openweather.apiKey) {
    try {
      const openweatherData = await getOpenWeatherData(lat, lon);
      results.openweather = openweatherData;
    } catch (error) {
      errors.push({ source: 'openweather', error: error.message });
    }
  }

  // Try WeatherAPI as backup
  if (WEATHER_APIS.weatherapi.apiKey) {
    try {
      const weatherapiData = await getWeatherAPIData(lat, lon);
      results.weatherapi = weatherapiData;
    } catch (error) {
      errors.push({ source: 'weatherapi', error: error.message });
    }
  }

  // Return consolidated data
  return {
    primary: results.openweather || results.weatherapi,
    backup: results.weatherapi || results.openweather,
    errors,
    consolidated: consolidateWeatherData(results)
  };
}

async function getOpenWeatherData(lat, lon) {
  const url = `${WEATHER_APIS.openweather.baseUrl}/weather`;
  const params = {
    lat,
    lon,
    appid: WEATHER_APIS.openweather.apiKey,
    units: 'metric'
  };

  const response = await axios.get(url, { params });
  
  return {
    temperature: response.data.main.temp,
    humidity: response.data.main.humidity,
    pressure: response.data.main.pressure,
    description: response.data.weather[0].description,
    icon: response.data.weather[0].icon,
    windSpeed: response.data.wind.speed,
    rain: response.data.rain ? response.data.rain['1h'] : 0,
    snow: response.data.snow ? response.data.snow['1h'] : 0,
    visibility: response.data.visibility,
    clouds: response.data.clouds.all
  };
}

async function getWeatherAPIData(lat, lon) {
  const url = `${WEATHER_APIS.weatherapi.baseUrl}/current.json`;
  const params = {
    key: WEATHER_APIS.weatherapi.apiKey,
    q: `${lat},${lon}`,
    aqi: 'no'
  };

  const response = await axios.get(url, { params });
  const current = response.data.current;
  
  return {
    temperature: current.temp_c,
    humidity: current.humidity,
    pressure: current.pressure_mb,
    description: current.condition.text,
    icon: current.condition.icon,
    windSpeed: current.wind_kph,
    rain: current.precip_mm,
    visibility: current.vis_km,
    cloudCover: current.cloud,
    uv: current.uv,
    feelsLike: current.feelslike_c
  };
}

async function getRainDetectionData(lat, lon, city, country) {
  const weatherData = await getWeatherFromMultipleSources(lat, lon, city, country);
  const primary = weatherData.primary;
  
  // Analyze rain conditions
  const rainAnalysis = {
    isRaining: false,
    rainIntensity: 'none',
    rainfallAmount: 0,
    probability: 0,
    impact: 'low'
  };

  if (primary) {
    // Check for rain indicators
    const hasRain = primary.rain > 0 || primary.snow > 0;
    const description = primary.description?.toLowerCase() || '';
    const isRainyDescription = description.includes('rain') || 
                              description.includes('drizzle') || 
                              description.includes('shower');

    rainAnalysis.isRaining = hasRain || isRainyDescription;
    rainAnalysis.rainfallAmount = primary.rain || 0;
    
    // Determine rain intensity
    if (rainAnalysis.rainfallAmount > 0) {
      if (rainAnalysis.rainfallAmount < 2.5) {
        rainAnalysis.rainIntensity = 'light';
      } else if (rainAnalysis.rainfallAmount < 7.5) {
        rainAnalysis.rainIntensity = 'moderate';
      } else {
        rainAnalysis.rainIntensity = 'heavy';
      }
    }

    // Determine impact on water quality
    if (rainAnalysis.isRaining) {
      if (rainAnalysis.rainIntensity === 'heavy') {
        rainAnalysis.impact = 'high';
      } else if (rainAnalysis.rainIntensity === 'moderate') {
        rainAnalysis.impact = 'medium';
      } else {
        rainAnalysis.impact = 'low';
      }
    }
  }

  return {
    current: primary,
    rainAnalysis,
    timestamp: new Date().toISOString()
  };
}

async function getWeatherForecast(lat, lon, days, city, country) {
  if (!WEATHER_APIS.weatherapi.apiKey) {
    throw new Error('WeatherAPI key not configured');
  }

  const url = `${WEATHER_APIS.weatherapi.baseUrl}/forecast.json`;
  const params = {
    key: WEATHER_APIS.weatherapi.apiKey,
    q: `${lat},${lon}`,
    days: Math.min(days, 14), // Max 14 days
    aqi: 'no',
    alerts: 'yes'
  };

  const response = await axios.get(url, { params });
  
  return {
    location: response.data.location,
    forecast: response.data.forecast.forecastday.map(day => ({
      date: day.date,
      maxTemp: day.day.maxtemp_c,
      minTemp: day.day.mintemp_c,
      avgTemp: day.day.avgtemp_c,
      totalRainfall: day.day.totalprecip_mm,
      maxWindSpeed: day.day.maxwind_kph,
      humidity: day.day.avghumidity,
      condition: day.day.condition,
      hourly: day.hour.map(hour => ({
        time: hour.time,
        temp: hour.temp_c,
        rainfall: hour.precip_mm,
        humidity: hour.humidity,
        condition: hour.condition
      }))
    })),
    alerts: response.data.alerts?.alert || []
  };
}

async function getRainfallHistory(lat, lon, days, city, country) {
  if (!WEATHER_APIS.weatherapi.apiKey) {
    throw new Error('WeatherAPI key not configured');
  }

  const url = `${WEATHER_APIS.weatherapi.baseUrl}/history.json`;
  const history = [];
  
  // Get historical data for the past N days
  for (let i = 1; i <= Math.min(days, 7); i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    try {
      const params = {
        key: WEATHER_APIS.weatherapi.apiKey,
        q: `${lat},${lon}`,
        dt: dateStr
      };

      const response = await axios.get(url, { params });
      const dayData = response.data.forecast.forecastday[0];
      
      history.push({
        date: dayData.date,
        totalRainfall: dayData.day.totalprecip_mm,
        maxRainfall: dayData.day.maxprecip_mm,
        avgHumidity: dayData.day.avghumidity,
        condition: dayData.day.condition
      });
    } catch (error) {
      logger.error(`Failed to fetch historical data for ${dateStr}:`, error.message);
    }
  }

  return {
    location: { lat, lon, city, country },
    history: history.reverse(), // Most recent first
    summary: {
      totalDays: history.length,
      totalRainfall: history.reduce((sum, day) => sum + day.totalRainfall, 0),
      averageRainfall: history.reduce((sum, day) => sum + day.totalRainfall, 0) / history.length,
      rainyDays: history.filter(day => day.totalRainfall > 0).length
    }
  };
}

function consolidateWeatherData(results) {
  const sources = Object.values(results).filter(Boolean);
  if (sources.length === 0) return null;

  // Use the first available source as primary
  const primary = sources[0];
  
  return {
    temperature: primary.temperature,
    humidity: primary.humidity,
    pressure: primary.pressure,
    description: primary.description,
    windSpeed: primary.windSpeed,
    rain: primary.rain || 0,
    visibility: primary.visibility,
    source: 'consolidated',
    confidence: sources.length > 1 ? 'high' : 'medium'
  };
}

module.exports = router;
