import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

interface Location {
  id: string;
  name: string;
}

interface RAGAnalysisProps {
  selectedLocation: Location;
}

interface RAGAnalysisData {
  summary: string;
  keyInsights: string[];
  sentiment: string;
  commonIssues: string[];
  recommendations: string[];
  trends: string[];
  reviewCount: number;
  timeRange: string;
}

export default function RAGAnalysis({ selectedLocation }: RAGAnalysisProps) {
  const [analysisData, setAnalysisData] = useState<RAGAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchRAGAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-enhanced/rag/summarize-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: {
            coordinates: [0, 0], // Placeholder coordinates
            address: selectedLocation.name
          },
          timeRange: 30, // Last 30 days
          includeRawData: false
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAnalysisData({
          summary: data.data.summary,
          keyInsights: data.data.keyInsights || [],
          sentiment: data.data.sentiment || 'neutral',
          commonIssues: data.data.commonIssues || [],
          recommendations: data.data.recommendations || [],
          trends: data.data.trends || [],
          reviewCount: data.data.reviewCount || 0,
          timeRange: data.data.timeRange || '30 days'
        });
        setLastUpdated(new Date());
      } else {
        throw new Error(data.message || 'Failed to fetch analysis');
      }
    } catch (error) {
      console.error('RAG Analysis error:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch analysis');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      fetchRAGAnalysis();
    }
  }, [selectedLocation]);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive':
      case 'very_positive':
        return 'text-green-600 bg-green-100';
      case 'negative':
      case 'very_negative':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive':
      case 'very_positive':
        return <CheckCircle className="h-4 w-4" />;
      case 'negative':
      case 'very_negative':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  if (isLoading && !analysisData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Analyzing community reviews...</span>
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
            onClick={fetchRAGAnalysis}
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
          <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analysis Available</h3>
          <p className="text-gray-600">No review data found for this location.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI-Powered Review Analysis</h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchRAGAnalysis}
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

      {/* Location Info */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-1">{selectedLocation.name}</h4>
        <p className="text-sm text-blue-700">
          Analysis based on {analysisData.reviewCount} reviews over {analysisData.timeRange}
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-3">Summary</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-gray-700 leading-relaxed">{analysisData.summary}</p>
        </div>
      </div>

      {/* Sentiment Analysis */}
      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-3">Community Sentiment</h4>
        <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-full ${getSentimentColor(analysisData.sentiment)}`}>
          {getSentimentIcon(analysisData.sentiment)}
          <span className="font-medium capitalize">{analysisData.sentiment.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Key Insights */}
      {analysisData.keyInsights.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">Key Insights</h4>
          <div className="space-y-2">
            {analysisData.keyInsights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-gray-700">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trends */}
      {analysisData.trends.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">Trends</h4>
          <div className="space-y-2">
            {analysisData.trends.map((trend, index) => (
              <div key={index} className="flex items-start space-x-2">
                <TrendingUp className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-gray-700">{trend}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common Issues */}
      {analysisData.commonIssues.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">Common Issues</h4>
          <div className="flex flex-wrap gap-2">
            {analysisData.commonIssues.map((issue, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm"
              >
                {issue.replace('_', ' ')}
              </span>
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
