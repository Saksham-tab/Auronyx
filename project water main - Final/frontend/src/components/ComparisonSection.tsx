import React from 'react';
import { Users, Activity, TrendingUp, Wifi } from 'lucide-react';
import CircularGauge from './CircularGauge';

interface ComparisonSectionProps {
  qualityScore: number;
  location: string;
}

export default function ComparisonSection({ qualityScore, location }: ComparisonSectionProps) {
  // Simulated IoT data for comparison
  const iotQualityScore = Math.min(100, qualityScore + Math.floor(Math.random() * 20) - 10);
  
  const reviewData = {
    totalReviews: 127,
    averageRating: (qualityScore / 100) * 5,
    lastUpdated: '2 hours ago'
  };

  const iotData = {
    sensorsActive: 3,
    dataPoints: 1440, // 24 hours * 60 minutes
    lastUpdated: 'Live'
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
        <TrendingUp className="h-5 w-5 text-blue-600" />
        <span>Data Source Comparison</span>
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Reviews Section */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span>Crowdsourced Reviews</span>
            </h4>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              Community Data
            </span>
          </div>
          
          <div className="flex justify-center mb-6">
            <CircularGauge value={qualityScore} label="User Rating" size="lg" />
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Reviews</span>
              <span className="font-semibold text-gray-900">{reviewData.totalReviews}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Average Rating</span>
              <span className="font-semibold text-gray-900">{reviewData.averageRating.toFixed(1)}/5 ⭐</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last Updated</span>
              <span className="font-semibold text-gray-900">{reviewData.lastUpdated}</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-white rounded-lg">
            <h5 className="font-medium text-gray-900 mb-2">Strengths</h5>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Real user experiences</li>
              <li>• Contextual insights</li>
              <li>• Health impact reports</li>
              <li>• Weather-related updates</li>
            </ul>
          </div>
        </div>

        {/* IoT Monitoring Section */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Activity className="h-5 w-5 text-green-600" />
              <span>IoT Real-Time Data</span>
            </h4>
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center space-x-1">
              <Wifi className="h-3 w-3" />
              <span>Live Data</span>
            </span>
          </div>
          
          <div className="flex justify-center mb-6">
            <CircularGauge value={iotQualityScore} label="Sensor Reading" size="lg" />
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Sensors</span>
              <span className="font-semibold text-gray-900">{iotData.sensorsActive}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Data Points (24h)</span>
              <span className="font-semibold text-gray-900">{iotData.dataPoints.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last Updated</span>
              <span className="font-semibold text-gray-900 text-green-600">{iotData.lastUpdated}</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-white rounded-lg">
            <h5 className="font-medium text-gray-900 mb-2">Strengths</h5>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Continuous monitoring</li>
              <li>• Precise measurements</li>
              <li>• Instant alerts</li>
              <li>• Historical trending</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Comparison Summary */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h5 className="font-semibold text-gray-900 mb-3">Combined Analysis for {location}</h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{qualityScore}%</div>
            <div className="text-sm text-gray-600">User Reviews</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{iotQualityScore}%</div>
            <div className="text-sm text-gray-600">IoT Sensors</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{Math.round((qualityScore + iotQualityScore) / 2)}%</div>
            <div className="text-sm text-gray-600">Combined Score</div>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-white rounded-lg">
          <p className="text-sm text-gray-700 text-center">
            <strong>Recommendation:</strong> {
              Math.round((qualityScore + iotQualityScore) / 2) >= 70 
                ? 'Water quality is generally safe for consumption with standard filtration.'
                : Math.round((qualityScore + iotQualityScore) / 2) >= 40
                  ? 'Water quality is moderate. Consider additional treatment methods.'
                  : 'Water quality is concerning. Use comprehensive filtration or alternative water sources.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}