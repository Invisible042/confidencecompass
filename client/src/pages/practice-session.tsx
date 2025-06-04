import { useState, useRef } from "react";
import { CameraFeed } from "@/components/practice/camera-feed";
import { VoiceAnalyzer } from "@/components/practice/voice-analyzer";
import { MetricsPanel } from "@/components/practice/metrics-panel";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/hooks/use-camera";
import { useVoiceAnalyzer } from "@/hooks/use-voice-analyzer";
import { useEyeTracking } from "@/hooks/use-eye-tracking";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, Video, Mic, MicOff } from "lucide-react";

export default function PracticeSession() {
  const [sessionActive, setSessionActive] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [title, setTitle] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { 
    videoRef, 
    stream, 
    isVideoEnabled, 
    toggleVideo, 
    startCamera, 
    stopCamera 
  } = useCamera();

  const {
    audioLevel,
    isRecording,
    voiceMetrics,
    startRecording,
    stopRecording,
    toggleMute
  } = useVoiceAnalyzer();

  const { eyeTrackingData, confidence } = useEyeTracking(videoRef, sessionActive);

  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: any) => {
      const response = await apiRequest("POST", "/api/sessions", sessionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/progress"] });
      toast({
        title: "Session Saved",
        description: "Your practice session has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save session. Please try again.",
        variant: "destructive",
      });
    }
  });

  const startSession = async () => {
    try {
      await startCamera();
      await startRecording();
      
      setSessionActive(true);
      setStartTime(new Date());
      setSessionTimer(0);
      setTitle(`Practice Session #${new Date().getTime()}`);

      // Start timer
      timerRef.current = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);

      toast({
        title: "Session Started",
        description: "Your practice session is now recording.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start session. Please check camera and microphone permissions.",
        variant: "destructive",
      });
    }
  };

  const stopSession = async () => {
    if (!sessionActive || !startTime) return;

    setSessionActive(false);
    stopCamera();
    stopRecording();

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Calculate session metrics
    const duration = sessionTimer;
    const eyeContactScore = eyeTrackingData.length > 0 
      ? eyeTrackingData.reduce((sum, data) => sum + data.confidence, 0) / eyeTrackingData.length * 100
      : 0;

    const avgVoiceClarity = voiceMetrics.length > 0
      ? voiceMetrics.reduce((sum, metric) => sum + metric.clarity, 0) / voiceMetrics.length
      : 0;

    const avgSpeakingPace = voiceMetrics.length > 0
      ? voiceMetrics.reduce((sum, metric) => sum + metric.pace, 0) / voiceMetrics.length
      : 0;

    const avgVolumeLevel = voiceMetrics.length > 0
      ? voiceMetrics.reduce((sum, metric) => sum + metric.volume, 0) / voiceMetrics.length
      : 0;

    const overallScore = (eyeContactScore + avgVoiceClarity + avgSpeakingPace) / 3;

    // Save session
    await createSessionMutation.mutateAsync({
      title,
      duration,
      eyeContactScore: eyeContactScore / 100,
      voiceClarity: avgVoiceClarity / 100,
      speakingPace: avgSpeakingPace / 100,
      volumeLevel: avgVolumeLevel / 100,
      overallScore: overallScore / 100,
      eyeTrackingData: eyeTrackingData,
      voiceMetrics: voiceMetrics
    });

    // Reset timer
    setSessionTimer(0);
    setStartTime(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Practice Session</h2>
          <p className="text-gray-600 mt-1">Improve your communication skills with real-time feedback</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={sessionActive ? stopSession : startSession}
            className={sessionActive 
              ? "bg-red-600 hover:bg-red-700" 
              : "bg-blue-600 hover:bg-blue-700"
            }
            disabled={createSessionMutation.isPending}
          >
            {sessionActive ? (
              <>
                <Square className="mr-2 h-4 w-4" />
                Stop Session
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Session
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Feed Section */}
        <div className="lg:col-span-2 space-y-6">
          <CameraFeed
            videoRef={videoRef}
            isActive={sessionActive}
            eyeTrackingData={eyeTrackingData}
            confidence={confidence}
            sessionTimer={formatTime(sessionTimer)}
          />
          
          {/* Camera Controls */}
          <div className="flex items-center justify-center space-x-4">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleVideo}
              className="w-12 h-12 rounded-full"
            >
              <Video className={`h-5 w-5 ${isVideoEnabled ? 'text-gray-600' : 'text-red-600'}`} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              className="w-12 h-12 rounded-full"
            >
              {isRecording ? (
                <Mic className="h-5 w-5 text-gray-600" />
              ) : (
                <MicOff className="h-5 w-5 text-red-600" />
              )}
            </Button>
          </div>
        </div>

        {/* Metrics Panel */}
        <MetricsPanel
          voiceMetrics={voiceMetrics}
          eyeContactScore={confidence * 100}
          sessionTimer={formatTime(sessionTimer)}
          overallScore={Math.round((confidence * 100 + audioLevel) / 2)}
          isActive={sessionActive}
        />
      </div>

      {/* Voice Analyzer (hidden component for audio processing) */}
      <VoiceAnalyzer />
    </div>
  );
}
