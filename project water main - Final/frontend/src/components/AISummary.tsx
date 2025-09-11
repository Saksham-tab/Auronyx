import { useState, useEffect } from 'react';
import { Brain, AlertTriangle, Lightbulb, Loader2, RefreshCw } from 'lucide-react';

interface AISummaryProps {
  location: string;
  qualityScore: number;
}

interface AIAnalysisData {
  location: string;
  safe_percentage: number;
  analysis: string;
  summary: string;
  review_count: number;
  sentiment_stats: Record<string, number>;
}

export default function AISummary({ location, qualityScore }: AISummaryProps) {
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

  // Fallback to static data if AI analysis fails
  const generateFallbackSummary = (score: number) => {
    if (score >= 70) {
      return {
        summary: "Most users report clean water in this area. The water is generally safe for consumption with minimal treatment required. Users consistently rate taste and clarity as good.",
        risks: ["Minor hardness may cause buildup in pipes"],
        remedies: ["Regular filter maintenance", "Use water softener if needed"]
      };
    } else if (score >= 40) {
      return {
        summary: "Mixed reviews in this area. Water quality varies throughout the day. After heavy rainfall, water becomes muddy and requires additional treatment before consumption.",
        risks: ["Hair fall due to water hardness", "Occasional stomach discomfort", "Metallic taste reported"],
        remedies: ["Boil water before consumption", "Use RO filtration system", "Install sediment filters"]
      };
    } else {
      return {
        summary: "Multiple users report poor water quality. Water is often murky with strong chemical odor. Not recommended for direct consumption without extensive treatment.",
        risks: ["High risk of waterborne diseases", "Skin irritation", "Strong chemical taste"],
        remedies: ["Mandatory water treatment before use", "Use bottled water for drinking", "Install comprehensive filtration system"]
      };
    }
  };

  // Use AI data if available, otherwise fallback to static data
  const getSummaryData = () => {
    if (aiData && !error) {
      // Parse the AI analysis to extract summary, risks and remedies
      const analysisText = aiData.analysis;
      const risks = [];
      const remedies = [];
      let summaryContent = '';
      
      // Extract summary - look for the first section or paragraph
      const summaryPatterns = [
        /1\.\s*(.*?)(?=\n\s*2\.|$)/s,
        /^(.*?)(?=\n\s*\d+\.|potential\s+risks?:|remedies?:|$)/si,
        /summary[:\s]*(.*?)(?=potential\s+risks?:|remedies?:|$)/si
      ];
      
      for (const pattern of summaryPatterns) {
        const match = analysisText.match(pattern);
        if (match && match[1]) {
          summaryContent = match[1].trim();
          // Clean up common prefixes
          summaryContent = summaryContent.replace(/^(based on.*?reviews.*?,?\s*)/i, '');
          if (summaryContent.length > 20) {
            break;
          }
        }
      }
      
      // If no good summary found, extract first meaningful paragraph
      if (!summaryContent || summaryContent.length < 20) {
        const paragraphs = analysisText.split('\n').filter(p => p.trim().length > 20);
        if (paragraphs.length > 0) {
          summaryContent = paragraphs[0].trim();
          // Remove numbering if present
          summaryContent = summaryContent.replace(/^1\.\s*/, '');
        }
      }
      
      // Extract risks - handle multiple formats
      const risksPatterns = [
        /3\.\s*potential\s+risks?[:\s]*([\s\S]*?)(?=4\.\s*remedies?|$)/i,
        /\*\*.*?potential\s+risks?.*?\*\*([\s\S]*?)(?=\*\*.*?remedies?|$)/i,
        /\d+\.\s*potential\s+risks?:([\s\S]*?)(?=\d+\.\s*remedies?|$)/i,
        /potential\s+risks?:([\s\S]*?)(?=remedies?:|$)/i
      ];
      
      let risksText = '';
      for (const pattern of risksPatterns) {
        const match = analysisText.match(pattern);
        if (match) {
          risksText = match[1];
          break;
        }
      }
      
      if (risksText) {
        // Extract risks from numbered lists, bullet points, or dashes
        const riskLines = risksText.split('\n')
          .filter(line => {
            const trimmed = line.trim();
            return trimmed.startsWith('-') || 
                   trimmed.startsWith('•') || 
                   /^\d+\./.test(trimmed) ||
                   (trimmed.length > 10 && !trimmed.includes(':'));
          });
        risks.push(...riskLines.map(line => 
          line.replace(/^[-•\d\.\s]*/, '').trim()
        ).filter(risk => risk.length > 0));
      }
      
      // Extract remedies - handle multiple formats
      const remediesPatterns = [
        /4\.\s*remedies?[:\s]*([\s\S]*?)$/i,
        /\*\*.*?remedies?.*?\*\*([\s\S]*?)$/i,
        /\d+\.\s*remedies?:([\s\S]*?)$/i,
        /remedies?:([\s\S]*?)$/i
      ];
      
      let remediesText = '';
      for (const pattern of remediesPatterns) {
        const match = analysisText.match(pattern);
        if (match) {
          remediesText = match[1];
          break;
        }
      }
      
      if (remediesText) {
        // Extract remedies from numbered lists, bullet points, or dashes
        const remedyLines = remediesText.split('\n')
          .filter(line => {
            const trimmed = line.trim();
            return trimmed.startsWith('-') || 
                   trimmed.startsWith('•') || 
                   /^\d+\./.test(trimmed) ||
                   (trimmed.length > 10 && !trimmed.includes(':'));
          });
        remedies.push(...remedyLines.map(line => 
          line.replace(/^[-•\d\.\s]*/, '').trim()
        ).filter(remedy => remedy.length > 0));
      }
      
      return {
        summary: summaryContent || aiData.analysis.split('\n')[0] || "Analysis completed for this location",
        risks: risks.length > 0 ? risks : ["No specific risks identified"],
        remedies: remedies.length > 0 ? remedies : ["No specific remedies provided"],
        reviewCount: aiData.review_count,
        safePercentage: aiData.safe_percentage
      };
    } else {
      const fallback = generateFallbackSummary(qualityScore);
      return {
        ...fallback,
        reviewCount: 0,
        safePercentage: qualityScore
      };
    }
  };

  const summaryData = getSummaryData();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <span>AI Analysis Summary for {location}</span>
        </h3>
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

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <span className="ml-2 text-gray-600">Analyzing water quality...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800 text-sm">
            <strong>AI Analysis Error:</strong> {error}
          </p>
          <p className="text-red-600 text-xs mt-1">
            Showing fallback analysis based on quality score: {qualityScore}%
          </p>
        </div>
      )}

      {!isLoading && (

      <div className="space-y-6">
        {/* Summary */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">
            Community Insights
            {summaryData.reviewCount > 0 && (
              <span className="text-sm text-gray-500 ml-2">
                (Based on {summaryData.reviewCount} reviews)
              </span>
            )}
          </h4>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
            <p className="text-blue-800 leading-relaxed">{summaryData.summary}</p>
          </div>
        </div>

        {/* Risks */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span>Potential Health Risks</span>
          </h4>
          <ul className="space-y-2">
            {summaryData.risks.map((risk, index) => (
              <li key={index} className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-gray-700">{risk}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Remedies */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
            <Lightbulb className="h-4 w-4 text-green-500" />
            <span>Recommended Solutions</span>
          </h4>
          <ul className="space-y-2">
            {summaryData.remedies.map((remedy, index) => (
              <li key={index} className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-gray-700">{remedy}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Rain Alert */}
        {qualityScore < 60 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-800">Weather Impact Alert</span>
            </div>
            <p className="text-yellow-700 mt-1">
              🚨 Rainfall detected – water reported as muddy in this region. Consider additional filtration during monsoon season.
            </p>
          </div>
        )}
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