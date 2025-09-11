import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, TrendingUp, Brain, Loader2, RefreshCw } from 'lucide-react';

interface Location {
  id: string;
  name: string;
}

interface IoTAnalysisProps {
  selectedLocation: Location;
  sensorData: {
    temperature: number;
    turbidity: number;
    tds: number;
    hardness: number;
  };
}

interface IoTAnalysisData {
  analysis: any;
  insights: string[];
  predictions: Array<{
    parameter: string;
    prediction: string;
    confidence: number;
    timeframe: string;
  }>;
  anomalies: Array<{
    parameter: string;
    value: number;
    expected: number;
    deviation: number;
    severity: string;
    description: string;
  }>;
  alerts: Array<{
    type: string;
    parameter: string;
    value: number;
    message: string;
    priority: string;
    timestamp: string;
  }>;
  recommendations: string[];
  qualityScore: number;
  riskAssessment: {
    overallRisk: string;
    risks: Array<{
      type: string;
      parameter: string;
      level: string;
      description: string;
    }>;
    recommendations: string[];
  };
}

export default function IoTAnalysis({ selectedLocation, sensorData }: IoTAnalysisProps) {
  const [analysisData, setAnalysisData] = useState<IoTAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchIoTAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-enhanced/iot/analyze-sensors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sensorData: {
            temperature: { value: sensorData.temperature, unit: '°C' },
            turbidity: { value: sensorData.turbidity, unit: 'NTU' },
            tds: { value: sensorData.tds, unit: 'ppm' },
            hardness: { value: sensorData.hardness, unit: 'mg/L' }
          },
          location: {
            coordinates: [0, 0], // Placeholder coordinates
            address: selectedLocation.name
          },
          timestamp: new Date().toISOString(),
          weatherData: {
            temperature: 25, // Placeholder weather data
            humidity: 60,
            rainfall: { amount: 0 }
          },
          includePredictions: true,
          includeAnomalies: true
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAnalysisData(data.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.message || 'Failed to fetch analysis');
      }
    } catch (error) {
      console.error('IoT Analysis error:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch analysis');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation && sensorData) {
      fetchIoTAnalysis();
    }
  }, [selectedLocation, sensorData]);

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'border-red-500 bg-red-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-green-500 bg-green-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  if (isLoading && !analysisData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Analyzing sensor data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchIoTAnalysis}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analysis Available</h3>
          <p className="text-gray-600">No sensor data available for analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI-Powered IoT Analysis</h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchIoTAnalysis}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title="Refresh Analysis"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Quality Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-gray-900">Overall Quality Score</h4>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(
            analysisData.qualityScore >= 80 ? 'low' : 
            analysisData.qualityScore >= 60 ? 'medium' : 'high'
          )}`}>
            {analysisData.qualityScore}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              analysisData.qualityScore >= 80 ? 'bg-green-500' :
              analysisData.qualityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${analysisData.qualityScore}%` }}
          ></div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-3">Risk Assessment</h4>
        <div className={`p-4 rounded-lg border-2 ${getPriorityColor(analysisData.riskAssessment.overallRisk)}`}>
          <div className="flex items-center space-x-2 mb-2">
            {analysisData.riskAssessment.overallRisk === 'high' ? (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            ) : analysisData.riskAssessment.overallRisk === 'medium' ? (
              <TrendingUp className="h-5 w-5 text-yellow-600" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            <span className="font-medium capitalize">
              {analysisData.riskAssessment.overallRisk} Risk
            </span>
          </div>
          {analysisData.riskAssessment.risks.length > 0 && (
            <div className="space-y-1">
              {analysisData.riskAssessment.risks.map((risk, index) => (
                <p key={index} className="text-sm text-gray-700">
                  • {risk.description}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      {analysisData.insights.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">Key Insights</h4>
          <div className="space-y-2">
            {analysisData.insights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-gray-700">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predictions */}
      {analysisData.predictions.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">Predictions</h4>
          <div className="space-y-3">
            {analysisData.predictions.map((prediction, index) => (
              <div key={index} className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">{prediction.parameter}</p>
                    <p className="text-sm text-blue-700">{prediction.prediction}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-blue-600">
                        Confidence: {Math.round(prediction.confidence * 100)}%
                      </span>
                      <span className="text-xs text-blue-600">
                        Timeframe: {prediction.timeframe}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomalies */}
      {analysisData.anomalies.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">Anomalies Detected</h4>
          <div className="space-y-3">
            {analysisData.anomalies.map((anomaly, index) => (
              <div key={index} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${getSeverityColor(anomaly.severity)}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900">{anomaly.parameter}</p>
                    <p className="text-sm text-yellow-700">{anomaly.description}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-yellow-600">
                        Current: {anomaly.value}
                      </span>
                      <span className="text-xs text-yellow-600">
                        Expected: {anomaly.expected}
                      </span>
                      <span className="text-xs text-yellow-600">
                        Deviation: {anomaly.deviation.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {analysisData.alerts.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">Active Alerts</h4>
          <div className="space-y-2">
            {analysisData.alerts.map((alert, index) => (
              <div key={index} className={`p-3 rounded-lg border-2 ${getPriorityColor(alert.priority)}`}>
                <div className="flex items-start space-x-2">
                  {alert.type === 'critical' ? (
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Activity className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analysisData.recommendations.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">Recommendations</h4>
          <div className="space-y-3">
            {analysisData.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-gray-700">{recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-gray-600">Updating analysis...</span>
          </div>
        </div>
      )}
    </div>
  );
}
