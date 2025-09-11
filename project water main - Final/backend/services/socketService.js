const { logger } = require('../utils/logger');

let io;

const initializeSocket = (socketIO) => {
  io = socketIO;
  
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);
    
    // Join location-based room
    socket.on('join_location', (location) => {
      const roomName = `location_${location.coordinates.join('_')}`;
      socket.join(roomName);
      logger.info(`Client ${socket.id} joined room: ${roomName}`);
    });
    
    // Leave location-based room
    socket.on('leave_location', (location) => {
      const roomName = `location_${location.coordinates.join('_')}`;
      socket.leave(roomName);
      logger.info(`Client ${socket.id} left room: ${roomName}`);``
    });
    
    // Subscribe to device updates
    socket.on('subscribe_device', (deviceId) => {
      const roomName = `device_${deviceId}`;
      socket.join(roomName);
      logger.info(`Client ${socket.id} subscribed to device: ${deviceId}`);
    });
    
    // Unsubscribe from device updates
    socket.on('unsubscribe_device', (deviceId) => {
      const roomName = `device_${deviceId}`;
      socket.leave(roomName);
      logger.info(`Client ${socket.id} unsubscribed from device: ${deviceId}`);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
  
  logger.info('Socket.IO service initialized');
};

// Emit water quality update to location room
const emitWaterQualityUpdate = (location, data) => {
  if (!io) return;
  
  const roomName = `location_${location.coordinates.join('_')}`;
  io.to(roomName).emit('water_quality_update', data);
};

// Emit device status update
const emitDeviceStatusUpdate = (deviceId, data) => {
  if (!io) return;
  
  const roomName = `device_${deviceId}`;
  io.to(roomName).emit('device_status_update', data);
};

// Emit alert notification
const emitAlertNotification = (location, alert) => {
  if (!io) return;
  
  const roomName = `location_${location.coordinates.join('_')}`;
  io.to(roomName).emit('alert_notification', alert);
};

// Emit weather update
const emitWeatherUpdate = (location, weather) => {
  if (!io) return;
  
  const roomName = `location_${location.coordinates.join('_')}`;
  io.to(roomName).emit('weather_update', weather);
};

// Broadcast to all connected clients
const broadcastToAll = (event, data) => {
  if (!io) return;
  
  io.emit(event, data);
};

module.exports = {
  initializeSocket,
  emitWaterQualityUpdate,
  emitDeviceStatusUpdate,
  emitAlertNotification,
  emitWeatherUpdate,
  broadcastToAll,
  getIO: () => io
};
