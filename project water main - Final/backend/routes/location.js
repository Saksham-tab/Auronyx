const express = require('express');
const router = express.Router();
const axios = require('axios');
const { logger } = require('../utils/logger');
const { validateLocation } = require('../middleware/validation');
const { optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route GET /api/location/geocode
 * @desc Get coordinates from address
 * @access Public
 */
router.get('/geocode', asyncHandler(async (req, res) => {
  const { address, city, state, country } = req.query;

  if (!address) {
    return res.status(400).json({
      success: false,
      message: 'Address is required'
    });
  }

  try {
    const fullAddress = [address, city, state, country].filter(Boolean).join(', ');
    
    // Try Google Maps Geocoding API first
    if (process.env.GOOGLE_MAPS_API_KEY) {
      const googleUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
      const params = {
        address: fullAddress,
        key: process.env.GOOGLE_MAPS_API_KEY
      };

      const response = await axios.get(googleUrl, { params });
      
      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const location = result.geometry.location;
        
        return res.json({
          success: true,
          data: {
            coordinates: [location.lat, location.lng],
            formattedAddress: result.formatted_address,
            addressComponents: result.address_components,
            source: 'google'
          }
        });
      }
    }

    // Fallback to OpenStreetMap Nominatim
    const nominatimUrl = 'https://nominatim.openstreetmap.org/search';
    const params = {
      q: fullAddress,
      format: 'json',
      limit: 1
    };

    const response = await axios.get(nominatimUrl, { params });
    
    if (response.data.length > 0) {
      const result = response.data[0];
      
      return res.json({
        success: true,
        data: {
          coordinates: [parseFloat(result.lat), parseFloat(result.lon)],
          formattedAddress: result.display_name,
          addressComponents: parseNominatimAddress(result),
          source: 'nominatim'
        }
      });
    }

    res.status(404).json({
      success: false,
      message: 'Address not found'
    });

  } catch (error) {
    logger.error('Geocoding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to geocode address',
      error: error.message
    });
  }
}));

/**
 * @route GET /api/location/reverse-geocode
 * @desc Get address from coordinates
 * @access Public
 */
router.get('/reverse-geocode', validateLocation, asyncHandler(async (req, res) => {
  const { lat, lon } = req.query;

  try {
    // Try Google Maps Reverse Geocoding API first
    if (process.env.GOOGLE_MAPS_API_KEY) {
      const googleUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
      const params = {
        latlng: `${lat},${lon}`,
        key: process.env.GOOGLE_MAPS_API_KEY
      };

      const response = await axios.get(googleUrl, { params });
      
      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        
        return res.json({
          success: true,
          data: {
            coordinates: [parseFloat(lat), parseFloat(lon)],
            formattedAddress: result.formatted_address,
            addressComponents: result.address_components,
            source: 'google'
          }
        });
      }
    }

    // Fallback to OpenStreetMap Nominatim
    const nominatimUrl = 'https://nominatim.openstreetmap.org/reverse';
    const params = {
      lat,
      lon,
      format: 'json'
    };

    const response = await axios.get(nominatimUrl, { params });
    
    if (response.data) {
      return res.json({
        success: true,
        data: {
          coordinates: [parseFloat(lat), parseFloat(lon)],
          formattedAddress: response.data.display_name,
          addressComponents: parseNominatimAddress(response.data),
          source: 'nominatim'
        }
      });
    }

    res.status(404).json({
      success: false,
      message: 'Location not found'
    });

  } catch (error) {
    logger.error('Reverse geocoding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reverse geocode coordinates',
      error: error.message
    });
  }
}));

/**
 * @route GET /api/location/nearby
 * @desc Find nearby locations
 * @access Public
 */
router.get('/nearby', validateLocation, asyncHandler(async (req, res) => {
  const { lat, lon, radius = 5, type } = req.query;

  try {
    // Use Google Places API for nearby search
    if (process.env.GOOGLE_MAPS_API_KEY) {
      const googleUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
      const params = {
        location: `${lat},${lon}`,
        radius: parseFloat(radius) * 1000, // Convert km to meters
        key: process.env.GOOGLE_MAPS_API_KEY
      };

      if (type) {
        params.type = type;
      }

      const response = await axios.get(googleUrl, { params });
      
      if (response.data.status === 'OK') {
        return res.json({
          success: true,
          data: {
            center: [parseFloat(lat), parseFloat(lon)],
            radius: parseFloat(radius),
            places: response.data.results.map(place => ({
              id: place.place_id,
              name: place.name,
              coordinates: [place.geometry.location.lat, place.geometry.location.lng],
              address: place.vicinity,
              types: place.types,
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total
            })),
            source: 'google'
          }
        });
      }
    }

    // Fallback to OpenStreetMap Overpass API
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"](around:${radius * 1000},${lat},${lon});
        way["amenity"](around:${radius * 1000},${lat},${lon});
        relation["amenity"](around:${radius * 1000},${lat},${lon});
      );
      out center;
    `;

    const response = await axios.get(overpassUrl, {
      params: { data: query }
    });

    if (response.data.elements) {
      const places = response.data.elements.map(element => ({
        id: element.id,
        name: element.tags?.name || 'Unnamed location',
        coordinates: element.center ? 
          [element.center.lat, element.center.lon] : 
          [element.lat, element.lon],
        address: element.tags?.addr_street || '',
        types: [element.tags?.amenity],
        source: 'openstreetmap'
      }));

      return res.json({
        success: true,
        data: {
          center: [parseFloat(lat), parseFloat(lon)],
          radius: parseFloat(radius),
          places,
          source: 'openstreetmap'
        }
      });
    }

    res.json({
      success: true,
      data: {
        center: [parseFloat(lat), parseFloat(lon)],
        radius: parseFloat(radius),
        places: [],
        source: 'none'
      }
    });

  } catch (error) {
    logger.error('Nearby search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find nearby locations',
      error: error.message
    });
  }
}));

/**
 * @route GET /api/location/autocomplete
 * @desc Get address autocomplete suggestions
 * @access Public
 */
router.get('/autocomplete', asyncHandler(async (req, res) => {
  const { query, country } = req.query;

  if (!query || query.length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Query must be at least 3 characters long'
    });
  }

  try {
    // Use Google Places Autocomplete API
    if (process.env.GOOGLE_MAPS_API_KEY) {
      const googleUrl = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
      const params = {
        input: query,
        key: process.env.GOOGLE_MAPS_API_KEY,
        types: 'geocode'
      };

      if (country) {
        params.components = `country:${country}`;
      }

      const response = await axios.get(googleUrl, { params });
      
      if (response.data.status === 'OK') {
        return res.json({
          success: true,
          data: {
            predictions: response.data.predictions.map(prediction => ({
              id: prediction.place_id,
              description: prediction.description,
              structuredFormatting: prediction.structured_formatting,
              types: prediction.types
            })),
            source: 'google'
          }
        });
      }
    }

    // Fallback to OpenStreetMap Nominatim
    const nominatimUrl = 'https://nominatim.openstreetmap.org/search';
    const params = {
      q: query,
      format: 'json',
      limit: 10,
      addressdetails: 1
    };

    if (country) {
      params.countrycodes = country;
    }

    const response = await axios.get(nominatimUrl, { params });
    
    return res.json({
      success: true,
      data: {
        predictions: response.data.map(result => ({
          id: result.place_id,
          description: result.display_name,
          coordinates: [parseFloat(result.lat), parseFloat(result.lon)],
          addressComponents: parseNominatimAddress(result),
          source: 'nominatim'
        })),
        source: 'nominatim'
      }
    });

  } catch (error) {
    logger.error('Autocomplete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get autocomplete suggestions',
      error: error.message
    });
  }
}));

/**
 * @route GET /api/location/timezone
 * @desc Get timezone for coordinates
 * @access Public
 */
router.get('/timezone', validateLocation, asyncHandler(async (req, res) => {
  const { lat, lon, timestamp } = req.query;

  try {
    // Use Google Timezone API
    if (process.env.GOOGLE_MAPS_API_KEY) {
      const googleUrl = 'https://maps.googleapis.com/maps/api/timezone/json';
      const params = {
        location: `${lat},${lon}`,
        timestamp: timestamp || Math.floor(Date.now() / 1000),
        key: process.env.GOOGLE_MAPS_API_KEY
      };

      const response = await axios.get(googleUrl, { params });
      
      if (response.data.status === 'OK') {
        return res.json({
          success: true,
          data: {
            coordinates: [parseFloat(lat), parseFloat(lon)],
            timezoneId: response.data.timeZoneId,
            timezoneName: response.data.timeZoneName,
            rawOffset: response.data.rawOffset,
            dstOffset: response.data.dstOffset,
            source: 'google'
          }
        });
      }
    }

    // Fallback to OpenStreetMap Nominatim
    const nominatimUrl = 'https://nominatim.openstreetmap.org/reverse';
    const params = {
      lat,
      lon,
      format: 'json',
      addressdetails: 1
    };

    const response = await axios.get(nominatimUrl, { params });
    
    if (response.data && response.data.address) {
      // Extract timezone from address details
      const timezone = response.data.address.timezone || 'UTC';
      
      return res.json({
        success: true,
        data: {
          coordinates: [parseFloat(lat), parseFloat(lon)],
          timezoneId: timezone,
          timezoneName: timezone,
          source: 'nominatim'
        }
      });
    }

    res.status(404).json({
      success: false,
      message: 'Timezone not found'
    });

  } catch (error) {
    logger.error('Timezone lookup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get timezone',
      error: error.message
    });
  }
}));

/**
 * @route GET /api/location/validate
 * @desc Validate coordinates or address
 * @access Public
 */
router.get('/validate', asyncHandler(async (req, res) => {
  const { lat, lon, address } = req.query;

  try {
    if (lat && lon) {
      // Validate coordinates
      const latNum = parseFloat(lat);
      const lonNum = parseFloat(lon);
      
      if (isNaN(latNum) || isNaN(lonNum)) {
        return res.json({
          success: true,
          data: {
            isValid: false,
            type: 'coordinates',
            reason: 'Invalid coordinate format'
          }
        });
      }

      if (latNum < -90 || latNum > 90) {
        return res.json({
          success: true,
          data: {
            isValid: false,
            type: 'coordinates',
            reason: 'Latitude must be between -90 and 90'
          }
        });
      }

      if (lonNum < -180 || lonNum > 180) {
        return res.json({
          success: true,
          data: {
            isValid: false,
            type: 'coordinates',
            reason: 'Longitude must be between -180 and 180'
          }
        });
      }

      return res.json({
        success: true,
        data: {
          isValid: true,
          type: 'coordinates',
          coordinates: [latNum, lonNum]
        }
      });
    }

    if (address) {
      // Validate address by attempting to geocode it
      const geocodeResult = await axios.get(`${req.protocol}://${req.get('host')}/api/location/geocode`, {
        params: { address }
      });

      if (geocodeResult.data.success) {
        return res.json({
          success: true,
          data: {
            isValid: true,
            type: 'address',
            address,
            coordinates: geocodeResult.data.data.coordinates
          }
        });
      } else {
        return res.json({
          success: true,
          data: {
            isValid: false,
            type: 'address',
            reason: 'Address not found'
          }
        });
      }
    }

    res.status(400).json({
      success: false,
      message: 'Either coordinates (lat, lon) or address must be provided'
    });

  } catch (error) {
    logger.error('Location validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate location',
      error: error.message
    });
  }
}));

// Helper functions
function parseNominatimAddress(data) {
  const address = data.address || {};
  
  return {
    street: address.road || address.street || '',
    houseNumber: address.house_number || '',
    city: address.city || address.town || address.village || '',
    state: address.state || address.province || '',
    country: address.country || '',
    postcode: address.postcode || '',
    countryCode: address.country_code || ''
  };
}

module.exports = router;
