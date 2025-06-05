import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Mic, Volume2, Gauge, Zap, Brain, MessageSquare } from "lucide-react";
import { VoiceMetric } from "@shared/schema";
import { AdvancedVoiceMetrics } from "@/lib/advanced-audio-analysis";

interface VoiceAnalysisDisplayProps {
  voiceMetrics: VoiceMetric[];
  advancedMetrics: AdvancedVoiceMetrics | null;
  deepgramTranscription: string;
  audioLevel: number;
  isAnalyzing: boolean;
  isRecording: boolean;
  hasDeepgramConnection: boolean;
  hasAdvancedAnalyzer: boolean;
}

export function VoiceAnalysisDisplay({
  voiceMetrics,
  advancedMetrics,
  deepgramTranscription,
  audioLevel,
  isAnalyzing,
  isRecording,
  hasDeepgramConnection,
  hasAdvancedAnalyzer
}: VoiceAnalysisDisplayProps) {
  const [realtimeMetrics, setRealtimeMetrics] = useState<VoiceMetric | null>(null);

  useEffect(() => {
    if (voiceMetrics.length > 0) {
      setRealtimeMetrics(voiceMetrics[voiceMetrics.length - 1]);
    }
  }, [voiceMetrics]);

  const getAverageMetrics = () => {
    if (voiceMetrics.length === 0) return null;
    
    const recent = voiceMetrics.slice(-50);
    return {
      volume: Math.round(recent.reduce((sum, m) => sum + m.volume, 0) / recent.length),
      pitch: Math.round(recent.reduce((sum, m) => sum + m.pitch, 0) / recent.length),
      clarity: Math.round(recent.reduce((sum, m) => sum + m.clarity, 0) / recent.length),
      pace: Math.round(recent.reduce((sum, m) => sum + m.pace, 0) / recent.length)
    };
  };

  const getVolumeStatus = (volume: number) => {
    if (volume < 20) return { status: "Too quiet", variant: "destructive" as const };
    if (volume > 80) return { status: "Too loud", variant: "destructive" as const };
    if (volume > 60) return { status: "Good volume", variant: "default" as const };
    return { status: "Moderate", variant: "secondary" as const };
  };

  const getPitchStatus = (pitch: number) => {
    if (pitch < 30) return { status: "Very low", variant: "secondary" as const };
    if (pitch > 70) return { status: "Very high", variant: "secondary" as const };
    return { status: "Natural", variant: "default" as const };
  };

  const getClarityStatus = (clarity: number) => {
    if (clarity > 75) return { status: "Excellent", variant: "default" as const };
    if (clarity > 50) return { status: "Good", variant: "secondary" as const };
    return { status: "Needs improvement", variant: "destructive" as const };
  };

  const getPaceStatus = (pace: number) => {
    if (pace < 30) return { status: "Too slow", variant: "secondary" as const };
    if (pace > 70) return { status: "Too fast", variant: "destructive" as const };
    return { status: "Good pace", variant: "default" as const };
  };

  const getTrembleStatus = () => {
    if (!advancedMetrics) return null;
    const intensity = advancedMetrics.trembleAnalysis.trembleIntensity;
    if (intensity < 20) return { status: "Stable", variant: "default" as const };
    if (intensity < 40) return { status: "Slight tremor", variant: "secondary" as const };
    return { status: "Noticeable tremor", variant: "destructive" as const };
  };

  const getEmotionDisplay = () => {
    if (!advancedMetrics) return null;
    const emotion = advancedMetrics.emotion;
    const emotionColors = {
      neutral: "bg-gray-500",
      happy: "bg-yellow-500",
      sad: "bg-blue-500",
      angry: "bg-red-500",
      fearful: "bg-purple-500",
      surprised: "bg-orange-500",
      disgusted: "bg-green-500"
    };
    
    return {
      emotion: emotion.emotion,
      confidence: emotion.confidence,
      color: emotionColors[emotion.emotion] || "bg-gray-500"
    };
  };

  const averages = getAverageMetrics();
  const volumeStatus = realtimeMetrics ? getVolumeStatus(realtimeMetrics.volume) : null;
  const pitchStatus = realtimeMetrics ? getPitchStatus(realtimeMetrics.pitch) : null;
  const clarityStatus = realtimeMetrics ? getClarityStatus(realtimeMetrics.clarity) : null;
  const paceStatus = realtimeMetrics ? getPaceStatus(realtimeMetrics.pace) : null;
  const trembleStatus = getTrembleStatus();
  const emotionDisplay = getEmotionDisplay();

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Mic className={`w-4 h-4 ${isRecording ? 'text-green-500' : 'text-gray-400'}`} />
          <span className="text-sm">Recording: {isRecording ? 'Active' : 'Inactive'}</span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2">
          <Brain className={`w-4 h-4 ${hasAdvancedAnalyzer ? 'text-blue-500' : 'text-gray-400'}`} />
          <span className="text-sm">Advanced Analysis: {hasAdvancedAnalyzer ? 'Enabled' : 'Disabled'}</span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2">
          <MessageSquare className={`w-4 h-4 ${hasDeepgramConnection ? 'text-purple-500' : 'text-gray-400'}`} />
          <span className="text-sm">Transcription: {hasDeepgramConnection ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Real-time Audio Level */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Audio Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={audioLevel} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className="font-medium">{Math.round(audioLevel)}%</span>
              <span>100%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Voice Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {volumeStatus && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={volumeStatus.variant}>{volumeStatus.status}</Badge>
              </div>
            )}
            {realtimeMetrics && (
              <>
                <Progress value={realtimeMetrics.volume} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  Current: {Math.round(realtimeMetrics.volume)}% 
                  {averages && ` | Avg: ${averages.volume}%`}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Pitch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pitchStatus && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={pitchStatus.variant}>{pitchStatus.status}</Badge>
              </div>
            )}
            {realtimeMetrics && (
              <>
                <Progress value={realtimeMetrics.pitch} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  Current: {Math.round(realtimeMetrics.pitch)}%
                  {averages && ` | Avg: ${averages.pitch}%`}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Clarity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {clarityStatus && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={clarityStatus.variant}>{clarityStatus.status}</Badge>
              </div>
            )}
            {realtimeMetrics && (
              <>
                <Progress value={realtimeMetrics.clarity} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  Current: {Math.round(realtimeMetrics.clarity)}%
                  {averages && ` | Avg: ${averages.clarity}%`}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Speaking Pace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {paceStatus && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={paceStatus.variant}>{paceStatus.status}</Badge>
              </div>
            )}
            {realtimeMetrics && (
              <>
                <Progress value={realtimeMetrics.pace} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  Current: {Math.round(realtimeMetrics.pace)}%
                  {averages && ` | Avg: ${averages.pace}%`}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Advanced Metrics */}
      {advancedMetrics && (
        <div className="space-y-4">
          <Separator />
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Advanced Analysis
            {isAnalyzing && <Badge variant="outline">Analyzing...</Badge>}
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Voice Stability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {trembleStatus && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tremor</span>
                    <Badge variant={trembleStatus.variant}>{trembleStatus.status}</Badge>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Jitter:</span>
                    <span>{advancedMetrics.trembleAnalysis.jitter.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Shimmer:</span>
                    <span>{advancedMetrics.trembleAnalysis.shimmer.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>HNR:</span>
                    <span>{advancedMetrics.trembleAnalysis.harmonicToNoiseRatio.toFixed(1)} dB</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Emotional State</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {emotionDisplay && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Emotion</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${emotionDisplay.color}`} />
                        <span className="text-sm capitalize">{emotionDisplay.emotion}</span>
                      </div>
                    </div>
                    <Progress value={emotionDisplay.confidence * 100} className="h-2" />
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Arousal:</span>
                        <span>{Math.round(advancedMetrics.emotion.arousal * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Valence:</span>
                        <span>{Math.round(advancedMetrics.emotion.valence * 100)}%</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Filler Words Detection */}
          {advancedMetrics.fillerWords.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Filler Words Detected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {advancedMetrics.fillerWords.slice(-5).map((filler, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      "{filler.word}" ({Math.round(filler.confidence * 100)}%)
                    </Badge>
                  ))}
                </div>
                {advancedMetrics.fillerWords.length > 5 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    +{advancedMetrics.fillerWords.length - 5} more
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Live Transcription */}
      {deepgramTranscription && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Live Transcription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-24 overflow-y-auto text-sm p-2 bg-muted/50 rounded">
              {deepgramTranscription || "Listening for speech..."}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}