import React, { useState, useEffect } from 'react';
import { Droplet, Loader2, RefreshCw } from 'lucide-react';
import CircularGauge from './CircularGauge';

interface WaterQualityCardProps {
  qualityScore: number;
  location: string;
}

interface AIAnalysisData {
  location: string;
  safe_percentage: number;
  analysis: string;
  summary: string;
  review_count: number;
  sentiment_stats: Record<string, number>;
}

export default function WaterQualityCard({ qualityScore, location }: WaterQualityCardProps) {
  const [aiData, setAiData] = useState<AIAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAIAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/analyze-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location }),
      });

      const result = await response.json();

      if (result.success) {
        setAiData(result.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(result.message || 'Failed to get AI analysis');
      }
    } catch (error) {
      console.error('AI Analysis error:', error);
      setError(error instanceof Error ? error.message : 'Failed to get AI analysis');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (location) {
      fetchAIAnalysis();
    }
  }, [location]);

  // Use AI-generated safe percentage if available, otherwise fallback to qualityScore
  const currentScore = aiData?.safe_percentage || qualityScore;
  const getQualityInfo = (score: number) => {
    if (score >= 70) {
      return {
        level: 'Safe',
        color: 'bg-green-100 text-green-800 border-green-200',
        description: 'Water quality is excellent and safe for consumption'
      };
    } else if (score >= 40) {
      return {
        level: 'Modrate',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        description: 'Water quality is acceptable but may need filtration'
      };
    } else {
      return {
        level: 'Unsafe',
        color: 'bg-red-100 text-red-800 border-red-200',
        description: 'Water quality is poor and not recommended for direct consumption'
      };
    }
  };

  const qualityInfo = getQualityInfo(currentScore);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Droplet className="h-5 w-5 text-blue-600" />
          <span>Water Quality Index</span>
        </h3>
        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${qualityInfo.color}`}>
            {qualityInfo.level}
          </span>
          <button
            onClick={fetchAIAnalysis}
            disabled={isLoading}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Refresh AI Analysis"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Analyzing water quality...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800 text-sm">
            <strong>AI Analysis Error:</strong> {error}
          </p>
          <p className="text-red-600 text-xs mt-1">
            Showing fallback score: {qualityScore}%
          </p>
        </div>
      )}

      {!isLoading && (
        <div className="flex flex-col items-center space-y-6">
          <CircularGauge value={currentScore} label="AI Safe Percentage" size="lg" />
          
          <div className="text-center">
            <h4 className="text-xl font-semibold text-gray-900 mb-2">{location}</h4>
            <p className="text-gray-600 max-w-md">{qualityInfo.description}</p>
            {aiData && (
              <p className="text-xs text-gray-500 mt-2">
                Based on {aiData.review_count} community reviews
              </p>
            )}
          </div>

        <div className="w-full bg-gray-100 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-2">Quality Range</h5>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-green-600 font-medium">70-100%</span>
              <span className="text-green-600">Safe</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-yellow-600 font-medium">40-70%</span>
              <span className="text-yellow-600">Moderate</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-600 font-medium">0-40%</span>
              <span className="text-red-600">Unsafe</span>
            </div>
          </div>
        </div>
        </div>
      )}

      {lastUpdated && !isLoading && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}