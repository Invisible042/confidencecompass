import { useEffect, useState, useRef } from "react";
import { 
  LiveKitRoom as LiveKitRoomComponent, 
  RoomAudioRenderer, 
  AudioTrack,
  BarVisualizer
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConversationTopic } from "@shared/schema";
import { Mic, MicOff, Volume2, VolumeX, Eye, Headphones, MessageCircle } from "lucide-react";
import { useCamera } from "@/hooks/use-camera";
import { useVoiceAnalyzer } from "@/hooks/use-voice-analyzer";
import { useEyeTracking } from "@/hooks/use-eye-tracking";
import { CameraFeed } from "@/components/practice/camera-feed";
import { MetricsPanel } from "@/components/practice/metrics-panel";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LiveKitRoomProps {
  roomData: {
    roomName: string;
    token: string;
    serverUrl: string;
  };
  topic: ConversationTopic;
  onEnd: () => void;
}

export function LiveKitRoom({ roomData, topic, onEnd }: LiveKitRoomProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Real-time tracking hooks
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

  const { eyeTrackingData, confidence } = useEyeTracking(videoRef, conversationStarted);

  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: any) => {
      const response = await apiRequest("POST", "/api/sessions", sessionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/progress"] });
      toast({
        title: "Conversation Session Saved",
        description: "Your AI conversation analysis has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save conversation session. Please try again.",
        variant: "destructive",
      });
    }
  });

  const saveConversationSession = async () => {
    if (!startTime) return;

    const duration = sessionTimer;
    const eyeContactScore = eyeTrackingData.length > 0 
      ? eyeTrackingData.reduce((sum, data) => sum + data.confidence, 0) / eyeTrackingData.length
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

    const overallScore = (eyeContactScore + (avgVoiceClarity / 100) + (avgSpeakingPace / 100)) / 3;

    await createSessionMutation.mutateAsync({
      title: `AI Conversation: ${topic.title}`,
      duration,
      eyeContactScore: eyeContactScore,
      voiceClarity: avgVoiceClarity / 100,
      speakingPace: avgSpeakingPace / 100,
      volumeLevel: avgVolumeLevel / 100,
      overallScore: overallScore,
      eyeTrackingData: eyeTrackingData,
      voiceMetrics: voiceMetrics,
      sessionType: "conversation",
      conversationTopic: topic.id,
      aiInteractions: {
        topic: topic.id,
        difficulty: topic.difficulty,
        category: topic.category,
        sessionDuration: duration
      }
    });
  };

  const handleConnected = async () => {
    setIsConnected(true);
    setStartTime(new Date());
    setSessionTimer(0);
    
    // Start camera and voice analysis
    try {
      await startCamera();
      await startRecording();
      
      // Start session timer
      timerRef.current = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
      
      setTimeout(() => {
        setConversationStarted(true);
      }, 2000);
    } catch (error) {
      console.error("Error starting tracking:", error);
    }
  };

  const handleDisconnected = async () => {
    setIsConnected(false);
    setConversationStarted(false);
    stopCamera();
    stopRecording();
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Save session data if conversation lasted more than 10 seconds
    if (sessionTimer > 10) {
      await saveConversationSession();
    }
  };

  const handleEndConversation = async () => {
    await handleDisconnected();
    onEnd();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl flex items-center justify-between">
            <span className="flex items-center">
              <MessageCircle className="mr-2 h-5 w-5" />
              {topic.title}
            </span>
            <Badge variant={topic.difficulty === 'beginner' ? 'default' : 
                          topic.difficulty === 'intermediate' ? 'secondary' : 'destructive'}>
              {topic.difficulty}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600 text-sm md:text-base">{topic.description}</p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{topic.category}</Badge>
                <span className="text-sm text-gray-500">
                  Session: {formatTime(sessionTimer)}
                </span>
              </div>
              <Button 
                variant="destructive" 
                onClick={handleEndConversation}
                className="w-full sm:w-auto"
              >
                End Conversation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Analysis Grid - Mobile Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Camera Feed and LiveKit Room */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <CameraFeed
            videoRef={videoRef}
            isActive={conversationStarted}
            eyeTrackingData={eyeTrackingData}
            confidence={confidence}
            sessionTimer={formatTime(sessionTimer)}
          />
          
          <LiveKitRoomComponent
            serverUrl={roomData.serverUrl}
            token={roomData.token}
            connect={true}
            onConnected={handleConnected}
            onDisconnected={handleDisconnected}
            options={{
              publishDefaults: {
                audio: true,
                video: false,
              },
              adaptiveStream: true,
              dynacast: true,
            }}
            className="h-32"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg flex items-center">
                  <Headphones className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                  AI Conversation Audio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleMute}
                    className="w-12 h-12 rounded-full"
                  >
                    {!isRecording ? (
                      <MicOff className="h-5 w-5 text-red-600" />
                    ) : (
                      <Mic className="h-5 w-5 text-gray-600" />
                    )}
                  </Button>
                  
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">
                      {isConnected ? 'Connected to AI Agent' : 'Connecting...'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Real-time conversation analysis active
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleVideo}
                    className="w-12 h-12 rounded-full"
                  >
                    <Eye className={`h-5 w-5 ${isVideoEnabled ? 'text-gray-600' : 'text-red-600'}`} />
                  </Button>
                </div>
                
                {/* Voice Activity Visualization */}
                <div className="mt-4">
                  <div className="flex items-end justify-center space-x-1 h-12 bg-gray-50 rounded-lg p-2">
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 bg-blue-500 rounded-full transition-all duration-150 ${
                          isRecording ? 'animate-pulse' : ''
                        }`}
                        style={{ 
                          height: `${(audioLevel / 100) * 80 + 20}%`,
                          animationDelay: `${i * 50}ms`
                        }}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <RoomAudioRenderer />
          </LiveKitRoomComponent>
        </div>

        {/* Real-time Metrics Panel */}
        <MetricsPanel
          voiceMetrics={voiceMetrics}
          eyeContactScore={confidence * 100}
          sessionTimer={formatTime(sessionTimer)}
          overallScore={Math.round((confidence * 100 + audioLevel) / 2)}
          isActive={conversationStarted}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Conversation Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Maintain natural eye contact with the camera</li>
            <li>• Speak clearly and at a comfortable pace</li>
            <li>• Listen actively to the AI responses</li>
            <li>• Practice natural conversation flow</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}