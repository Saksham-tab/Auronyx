import React from 'react';
import { Activity, Thermometer, Droplets } from 'lucide-react';
import CircularGauge from './CircularGauge';

interface Location {
  id: string;
  name: string;
}

interface IoTMonitoringProps {
  selectedLocation: Location;
}

export default function IoTMonitoring({ selectedLocation }: IoTMonitoringProps) {
  // Simulated IoT sensor data based on location
  const getSensorData = (locationId: string) => {
    const locationData: Record<string, any> = {
      '1': { // Downtown Area
        temperature: 23.5,
        turbidity: 2.1,
        tds: 150,
        hardness: 65
      },
      '2': { // Residential District
        temperature: 22.8,
        turbidity: 1.8,
        tds: 120,
        hardness: 45
      },
      '3': { // Industrial Zone
        temperature: 26.2,
        turbidity: 4.2,
        tds: 280,
        hardness: 95
      }
    };
    return locationData[locationId] || locationData['1'];
  };

  const sensorData = getSensorData(selectedLocation.id);

  const getTemperatureScore = (temp: number) => {
    if (temp >= 20 && temp <= 25) return 85;
    if (temp >= 15 && temp <= 30) return 70;
    return 40;
  };

  const getTurbidityScore = (turbidity: number) => {
    if (turbidity < 5) return 90;
    if (turbidity < 10) return 70;
    return 30;
  };

  const getTDSScore = (tds: number) => {
    if (tds <= 300) return 85;
    if (tds <= 600) return 65;
    return 35;
  };

  const getHardnessScore = (hardness: number) => {
    if (hardness <= 60) return 90;
    if (hardness <= 120) return 70;
    return 45;
  };

  // Calculate total sensor score (average of all sensor scores)
  const calculateTotalSensorScore = () => {
    const tempScore = getTemperatureScore(sensorData.temperature);
    const turbidityScore = getTurbidityScore(sensorData.turbidity);
    const tdsScore = getTDSScore(sensorData.tds);
    const hardnessScore = getHardnessScore(sensorData.hardness);
    
    const totalScore = Math.round((tempScore + turbidityScore + tdsScore + hardnessScore) / 4);
    return totalScore;
  };

  const totalSensorScore = calculateTotalSensorScore();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center space-x-2">
        <Activity className="h-5 w-5 text-green-600" />
        <span>Real-Time IoT Monitoring</span>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="text-center">
          <CircularGauge 
            value={getTemperatureScore(sensorData.temperature)} 
            label="Temperature"
            size="md"
          />
          <p className="text-sm text-gray-600 mt-2 flex items-center justify-center space-x-1">
            <Thermometer className="h-4 w-4" />
            <span>{sensorData.temperature}°C</span>
          </p>
        </div>

        <div className="text-center">
          <CircularGauge 
            value={getTurbidityScore(sensorData.turbidity)} 
            label="Turbidity"
            size="md"
          />
          <p className="text-sm text-gray-600 mt-2">{sensorData.turbidity} NTU</p>
        </div>

        <div className="text-center">
          <CircularGauge 
            value={getTDSScore(sensorData.tds)} 
            label="TDS"
            size="md"
          />
          <p className="text-sm text-gray-600 mt-2 flex items-center justify-center space-x-1">
            <Droplets className="h-4 w-4" />
            <span>{sensorData.tds} ppm</span>
          </p>
        </div>

        <div className="text-center">
          <CircularGauge 
            value={getHardnessScore(sensorData.hardness)} 
            label="Hardness"
            size="md"
          />
          <p className="text-sm text-gray-600 mt-2">{sensorData.hardness} mg/L</p>
        </div>
      </div>

      {/* Total Sensor Score */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center justify-between">
          <span>Overall Sensor Score</span>
          <span className="text-2xl font-bold text-blue-600">{totalSensorScore}%</span>
        </h4>
        <div className="text-sm text-gray-600">
          <p>Average score based on all sensor readings:</p>
          <ul className="mt-2 space-y-1">
            <li>• Temperature: {getTemperatureScore(sensorData.temperature)}%</li>
            <li>• Turbidity: {getTurbidityScore(sensorData.turbidity)}%</li>
            <li>• TDS: {getTDSScore(sensorData.tds)}%</li>
            <li>• Hardness: {getHardnessScore(sensorData.hardness)}%</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Sensor Status - {selectedLocation.name}</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Last Updated:</span>
            <span className="text-green-600 font-medium">Live</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Data Source:</span>
            <span className="text-blue-600 font-medium">ESP32 Sensor</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Location:</span>
            <span className="text-blue-600 font-medium">{selectedLocation.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Connection:</span>
            <span className="text-green-600 font-medium">Strong</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Battery:</span>
            <span className="text-green-600 font-medium">95%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Signal:</span>
            <span className="text-green-600 font-medium">Excellent</span>
          </div>
        </div>
      </div>
    </div>
  );
}