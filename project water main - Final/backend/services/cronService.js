const cron = require('node-cron');
const { logger } = require('../utils/logger');
const ESP32Device = require('../models/ESP32Device');
const WaterQuality = require('../models/WaterQuality');

const initializeCronJobs = () => {
  // Check device status every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('Running device status check...');
      
      const devices = await ESP32Device.find({});
      const now = new Date();
      
      for (const device of devices) {
        const timeSinceLastSeen = now - device.lastSeen;
        const timeout = 10 * 60 * 1000; // 10 minutes
        
        if (device.status === 'online' && timeSinceLastSeen > timeout) {
          device.status = 'offline';
          await device.save();
          logger.info(`Device ${device.deviceId} marked as offline`);
        }
      }
    } catch (error) {
      logger.error('Device status check error:', error);
    }
  });
  
  // Clean up old data daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('Running data cleanup...');
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const result = await WaterQuality.deleteMany({
        timestamp: { $lt: thirtyDaysAgo },
        source: 'esp32'
      });
      
      logger.info(`Cleaned up ${result.deletedCount} old water quality records`);
    } catch (error) {
      logger.error('Data cleanup error:', error);
    }
  });
  
  // Generate daily reports at 6 AM
  cron.schedule('0 6 * * *', async () => {
    try {
      logger.info('Generating daily reports...');
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dailyStats = await WaterQuality.aggregate([
        {
          $match: {
            timestamp: { $gte: yesterday, $lt: today }
          }
        },
        {
          $group: {
            _id: null,
            totalReadings: { $sum: 1 },
            avgQualityScore: { $avg: '$qualityScore' },
            bySource: {
              $push: '$source'
            }
          }
        }
      ]);
      
      if (dailyStats.length > 0) {
        logger.info('Daily stats:', dailyStats[0]);
      }
    } catch (error) {
      logger.error('Daily report generation error:', error);
    }
  });
  
  logger.info('Cron jobs initialized');
};

module.exports = {
  initializeCronJobs
};
