# Water Quality Monitoring System - Backend

A comprehensive backend system for monitoring water quality using IoT devices (ESP32), user reviews, and AI-powered analysis.

## Features

- **IoT Integration**: ESP32 device management and sensor data processing
- **User Management**: Authentication, authorization, and user profiles
- **Water Quality Monitoring**: Real-time sensor data and user reviews
- **AI Analysis**: OpenAI-powered water quality analysis and recommendations
- **Weather Integration**: Real-time weather data and rain detection
- **Location Services**: Geocoding, reverse geocoding, and location-based queries
- **Notifications**: Email, SMS, and push notifications
- **Admin Dashboard**: System administration and monitoring
- **Real-time Updates**: Socket.IO for live data updates

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt
- **Real-time**: Socket.IO
- **AI**: 
- **Weather APIs**: OpenWeatherMap, WeatherAPI, AccuWeather
- **Location APIs**: Google Maps, OpenStreetMap
- **Notifications**: Nodemailer, Twilio
- **Validation**: Joi
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate Limiting

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/water_quality_db
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=7d
   
   # Weather APIs
   OPENWEATHER_API_KEY=your_openweather_api_key_here
   WEATHERAPI_KEY=your_weatherapi_key_here
   ACCUWEATHER_API_KEY=your_accuweather_api_key_here
   
   # Location Services
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   MAPBOX_API_KEY=your_mapbox_api_key_here
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Email Configuration
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_email_password
   
   # SMS Configuration (Twilio)
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   ```

4. **Database Setup**
   ```bash
   # Start MongoDB (if not running)
   mongod
   
   # Seed initial data
   npm run seed
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Documentation

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "location": {
    "coordinates": [-74.006, 40.7128],
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "country": "USA"
    }
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Water Quality

#### Get Water Quality Data
```http
GET /api/water-quality?lat=40.7128&lon=-74.006&radius=10&limit=50
Authorization: Bearer <token>
```

#### Submit Water Quality Review
```http
POST /api/water-quality/review
Authorization: Bearer <token>
Content-Type: application/json

{
  "location": {
    "coordinates": [-74.006, 40.7128],
    "address": {
      "street": "123 Main St",
      "city": "New York"
    }
  },
  "reviewData": {
    "overallRating": 4,
    "taste": {
      "rating": 4,
      "description": "Clean and fresh"
    },
    "clarity": {
      "rating": 3,
      "description": "Slightly cloudy"
    },
    "odor": {
      "rating": 4,
      "description": "No odor"
    },
    "healthEffects": ["none"],
    "additionalComments": "Good water quality"
  }
}
```

### ESP32 Integration

#### Submit Sensor Data
```http
POST /api/esp32/data
Content-Type: application/json
X-Device-Token: <device_token>

{
  "deviceId": "ESP32_001",
  "timestamp": "2024-01-01T12:00:00Z",
  "sensors": {
    "ph": { "value": 7.2, "unit": "pH" },
    "turbidity": { "value": 2.1, "unit": "NTU" },
    "temperature": { "value": 22.5, "unit": "°C" },
    "tds": { "value": 150, "unit": "ppm" },
    "conductivity": { "value": 300, "unit": "µS/cm" },
    "dissolvedOxygen": { "value": 8.5, "unit": "mg/L" }
  },
  "location": {
    "latitude": 40.7128,
    "longitude": -74.006,
    "address": {
      "street": "Central Park",
      "city": "New York"
    }
  },
  "batteryLevel": 85,
  "signalStrength": 90,
  "deviceTemperature": 25.0
}
```

### Weather Integration

#### Get Current Weather
```http
GET /api/weather/current?lat=40.7128&lon=-74.006
```

#### Get Rain Forecast
```http
GET /api/weather/forecast?lat=40.7128&lon=-74.006&days=7
```

### Location Services

#### Geocode Address
```http
GET /api/location/geocode?address=123 Main St, New York, NY
```

#### Reverse Geocode
```http
GET /api/location/reverse-geocode?lat=40.7128&lon=-74.006
```

### AI Analysis

#### Analyze Water Quality
```http
POST /api/ai/analyze
Authorization: Bearer <token>
Content-Type: application/json

{
  "location": {
    "coordinates": [-74.006, 40.7128]
  },
  "sensorData": {
    "ph": 7.2,
    "turbidity": 2.1,
    "temperature": 22.5
  },
  "reviewData": {
    "overallRating": 4,
    "taste": { "rating": 4 }
  }
}
```

#### Get AI Summary
```http
GET /api/ai/summary/40.7128,-74.006?days=30
```

### Notifications

#### Send Notification
```http
POST /api/notifications/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "email",
  "recipients": ["user_id_1", "user_id_2"],
  "subject": "Water Quality Alert",
  "message": "Critical water quality issue detected",
  "priority": "high"
}
```

### Admin Routes

#### Get Dashboard Stats
```http
GET /api/admin/dashboard
Authorization: Bearer <admin_token>
```

#### Get All Users
```http
GET /api/admin/users?page=1&limit=20&search=john
Authorization: Bearer <admin_token>
```

## Database Schema

### User
```javascript
{
  username: String,
  email: String,
  password: String,
  firstName: String,
  lastName: String,
  phone: String,
  role: String, // 'user', 'moderator', 'admin'
  isActive: Boolean,
  isVerified: Boolean,
  location: {
    type: 'Point',
    coordinates: [Number],
    address: Object
  },
  preferences: {
    notifications: {
      email: Boolean,
      sms: Boolean,
      push: Boolean
    }
  }
}
```

### WaterQuality
```javascript
{
  location: {
    type: 'Point',
    coordinates: [Number],
    address: Object
  },
  source: String, // 'esp32', 'user_review', 'manual_entry'
  deviceId: String,
  userId: ObjectId,
  timestamp: Date,
  sensorData: {
    ph: { value: Number, unit: String },
    turbidity: { value: Number, unit: String },
    temperature: { value: Number, unit: String },
    tds: { value: Number, unit: String },
    conductivity: { value: Number, unit: String },
    dissolvedOxygen: { value: Number, unit: String }
  },
  reviewData: {
    overallRating: Number,
    taste: Object,
    clarity: Object,
    odor: Object,
    healthEffects: [String],
    additionalComments: String
  },
  qualityScore: Number,
  assessment: {
    status: String,
    summary: String,
    details: Object
  },
  weatherConditions: Object,
  alerts: {
    isAlert: Boolean,
    acknowledged: Boolean,
    acknowledgedBy: ObjectId,
    acknowledgedAt: Date
  }
}
```

### ESP32Device
```javascript
{
  deviceId: String,
  name: String,
  location: {
    type: 'Point',
    coordinates: [Number],
    address: Object
  },
  status: String, // 'online', 'offline', 'maintenance', 'error'
  lastSeen: Date,
  ipAddress: String,
  macAddress: String,
  sensors: {
    ph: { enabled: Boolean, calibrationOffset: Number },
    turbidity: { enabled: Boolean, calibrationOffset: Number },
    temperature: { enabled: Boolean, calibrationOffset: Number },
    tds: { enabled: Boolean, calibrationOffset: Number },
    conductivity: { enabled: Boolean, calibrationOffset: Number },
    dissolvedOxygen: { enabled: Boolean, calibrationOffset: Number }
  },
  thresholds: {
    ph: { min: Number, max: Number, criticalMin: Number, criticalMax: Number },
    turbidity: { max: Number, criticalMax: Number },
    temperature: { min: Number, max: Number, criticalMin: Number, criticalMax: Number },
    tds: { min: Number, max: Number, criticalMin: Number, criticalMax: Number },
    dissolvedOxygen: { min: Number, criticalMin: Number }
  },
  configuration: {
    samplingInterval: Number,
    uploadInterval: Number,
    wifiSSID: String,
    timezone: String
  }
}
```

## Socket.IO Events

### Client to Server
- `join_location`: Join location-based room
- `leave_location`: Leave location-based room
- `subscribe_device`: Subscribe to device updates
- `unsubscribe_device`: Unsubscribe from device updates

### Server to Client
- `water_quality_update`: New water quality data
- `device_status_update`: Device status change
- `alert_notification`: New alert notification
- `weather_update`: Weather data update

## Error Handling

The API uses standardized error responses:

```javascript
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "field_name",
      "message": "Validation error message"
    }
  ]
}
```

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation with Joi
- SQL injection prevention (MongoDB)
- XSS protection

## Logging

The system uses Winston for structured logging:

- Console logging in development
- File logging in production
- Error tracking
- API request logging
- Security event logging

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --grep "auth"
```

## Deployment

### Docker
```bash
# Build image
docker build -t water-quality-backend .

# Run container
docker run -p 5000:5000 water-quality-backend
```

### Environment Variables
Set the following environment variables in production:
- `NODE_ENV=production`
- `MONGODB_URI`: Production MongoDB connection string
- `JWT_SECRET`: Strong secret key
- All API keys for external services

### PM2
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name "water-quality-backend"

# Monitor
pm2 monit
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## Changelog

### v1.0.0
- Initial release
- Basic water quality monitoring
- ESP32 integration
- User authentication
- AI analysis
- Weather integration
- Location services
- Notifications system
- Admin dashboard
