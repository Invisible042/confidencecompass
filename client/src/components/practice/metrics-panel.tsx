import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VoiceMetric } from "@shared/schema";
import { Lightbulb } from "lucide-react";

interface MetricsPanelProps {
  voiceMetrics: VoiceMetric[];
  eyeContactScore: number;
  sessionTimer: string;
  overallScore: number;
  isActive: boolean;
}

export function MetricsPanel({
  voiceMetrics,
  eyeContactScore,
  sessionTimer,
  overallScore,
  isActive
}: MetricsPanelProps) {
  const latestVoiceMetric = voiceMetrics[voiceMetrics.length - 1];
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getGrade = (score: number) => {
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B+";
    if (score >= 60) return "B";
    if (score >= 50) return "C+";
    return "C";
  };

  return (
    <div className="space-y-6">
      {/* Voice Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Voice Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Volume Level */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Volume</span>
              <span className={`text-sm font-semibold ${getScoreColor(latestVoiceMetric?.volume || 0)}`}>
                {Math.round(latestVoiceMetric?.volume || 0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${latestVoiceMetric?.volume || 0}%` }}
              />
            </div>
          </div>

          {/* Speaking Pace */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Pace</span>
              <span className={`text-sm font-semibold ${getScoreColor(latestVoiceMetric?.pace || 0)}`}>
                {latestVoiceMetric?.pace > 80 ? "Good" : latestVoiceMetric?.pace > 60 ? "Fair" : "Slow"}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${latestVoiceMetric?.pace || 0}%` }}
              />
            </div>
          </div>

          {/* Clarity Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Clarity</span>
              <span className={`text-sm font-semibold ${getScoreColor(latestVoiceMetric?.clarity || 0)}`}>
                {Math.round(latestVoiceMetric?.clarity || 0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${latestVoiceMetric?.clarity || 0}%` }}
              />
            </div>
          </div>

          {/* Audio Waveform Visualization */}
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Audio Waveform</p>
            <div className="flex items-end justify-center space-x-1 h-16 bg-gray-50 rounded-lg p-2">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 bg-blue-500 rounded-full transition-all duration-150 ${
                    isActive ? 'animate-pulse' : ''
                  }`}
                  style={{ 
                    height: `${Math.random() * 80 + 20}%`,
                    animationDelay: `${i * 50}ms`
                  }}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Session Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session Timer */}
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">{sessionTimer}</div>
            <p className="text-sm text-gray-600">Session Duration</p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className={`text-lg font-bold ${getScoreColor(eyeContactScore)}`}>
                {Math.round(eyeContactScore)}%
              </div>
              <p className="text-xs text-gray-600">Eye Contact</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className={`text-lg font-bold ${getScoreColor(overallScore)}`}>
                {getGrade(overallScore)}
              </div>
              <p className="text-xs text-gray-600">Overall Grade</p>
            </div>
          </div>

          {/* Quick Feedback */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Quick Tip</h4>
                <p className="text-sm text-blue-700">
                  {eyeContactScore > 80 
                    ? "Great eye contact! Keep it up."
                    : eyeContactScore > 60
                    ? "Try to maintain eye contact for longer periods."
                    : "Look directly at the camera lens to improve your score."
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
