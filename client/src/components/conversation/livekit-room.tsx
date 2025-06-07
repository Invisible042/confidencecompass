import { useEffect, useState, useRef, useCallback } from "react";
import { 
  LiveKitRoom as LiveKitRoomComponent, 
  RoomAudioRenderer, 
  AudioTrack,
  BarVisualizer,
  useRoom,
  useParticipant
} from "@livekit/components-react";
import { Track, RoomEvent, RemoteParticipant } from "livekit-client";
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
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const room = useRoom();
  const aiParticipant = useParticipant("ai-agent");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Camera and analysis hooks
  const { startCamera, stopCamera, isActive: isCameraActive } = useCamera();
  const { startEyeTracking, stopEyeTracking, eyeTrackingData, confidence } = useEyeTracking();
  const { startAnalysis, stopAnalysis, metrics } = useVoiceAnalyzer({
    enableDeepgram: true,
    deepgramApiKey: process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY
  });

  // End conversation mutation
  const endConversationMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/conversation/end", {
        method: "POST",
        body: JSON.stringify({ roomName: roomData.roomName })
      });
    },
    onSuccess: () => {
      cleanup();
      onEnd();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to end conversation. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    stopCamera();
    stopEyeTracking();
    stopAnalysis();
    setIsRecording(false);
    setConversationStarted(false);
    if (room) {
      room.disconnect();
    }
  }, [stopCamera, stopEyeTracking, stopAnalysis, room]);

  // Handle room connection
  const handleConnected = useCallback(async () => {
    try {
      setIsConnected(true);
      setConversationStarted(true);
      
      // Start camera and tracking
      if (videoRef.current) {
        await startCamera(videoRef.current);
        startEyeTracking(videoRef.current);
      }
      
      // Start voice analysis
      startAnalysis();
      setIsRecording(true);
      
      // Start session timer
      timerRef.current = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("Error in handleConnected:", error);
      setError("Failed to initialize camera and tracking");
      toast({
        title: "Error",
        description: "Failed to initialize camera and tracking. Please check your permissions.",
        variant: "destructive"
      });
    }
  }, [startCamera, startEyeTracking, startAnalysis, toast]);

  // Handle room disconnection
  const handleDisconnected = useCallback(() => {
    cleanup();
    setIsConnected(false);
    toast({
      title: "Disconnected",
      description: "Connection to the conversation room was lost.",
      variant: "destructive"
    });
  }, [cleanup, toast]);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    console.error("LiveKit room error:", error);
    setError(error.message);
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive"
    });
  }, [toast]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (room) {
      const audioTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (audioTrack) {
        if (isMuted) {
          room.localParticipant.unmuteMicrophone();
        } else {
          room.localParticipant.muteMicrophone();
        }
        setIsMuted(!isMuted);
      }
    }
  }, [room, isMuted]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (room) {
      const videoTrack = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (videoTrack) {
        if (isVideoEnabled) {
          room.localParticipant.unpublishTrack(videoTrack.track);
        } else {
          room.localParticipant.publishTrack(videoTrack.track);
        }
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  }, [room, isVideoEnabled]);

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  if (error) {
  return (
      <Card className="p-4">
        <CardContent>
          <p className="text-red-500">{error}</p>
          <Button onClick={onEnd} className="mt-4">
            End Session
              </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
            onError={handleError}
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
                {aiParticipant && (
                <div className="mt-4">
                    <BarVisualizer
                      participant={aiParticipant}
                      className="h-8"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </LiveKitRoomComponent>
        </div>

        {/* Metrics Panel */}
        <div className="lg:col-span-1">
        <MetricsPanel
            metrics={metrics}
            eyeTrackingData={eyeTrackingData}
            sessionDuration={sessionTimer}
          />
        </div>
      </div>

      {/* End Session Button */}
      <div className="flex justify-end">
        <Button
          variant="destructive"
          onClick={() => endConversationMutation.mutate()}
          disabled={endConversationMutation.isPending}
        >
          {endConversationMutation.isPending ? "Ending..." : "End Session"}
        </Button>
      </div>
    </div>
  );
}