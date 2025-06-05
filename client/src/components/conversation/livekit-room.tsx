import { useEffect, useState } from "react";
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
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

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

  const handleConnected = () => {
    setIsConnected(true);
    setTimeout(() => {
      setConversationStarted(true);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>AI Conversation Session</span>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">{topic.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{topic.description}</p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="secondary">{topic.category}</Badge>
                <Badge className={
                  topic.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                  topic.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }>
                  {topic.difficulty}
                </Badge>
              </div>
            </div>
            <Button onClick={onEnd} variant="destructive">
              End Session
            </Button>
          </div>
        </CardContent>
      </Card>

      <LiveKitRoomComponent
        serverUrl={roomData.serverUrl}
        token={roomData.token}
        connect={true}
        onConnected={handleConnected}
        onDisconnected={() => setIsConnected(false)}
        options={{
          publishDefaults: {
            audioEnabled: true,
            videoEnabled: false,
          },
          adaptiveStream: true,
          dynacast: true,
        }}
        className="h-96"
      >
        <div className="h-full flex flex-col">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="text-lg">Voice Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-md">
                <div className="flex items-end justify-center space-x-1 h-16 bg-gray-50 rounded-lg p-2">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 bg-blue-500 rounded-full transition-all duration-150 ${
                        isConnected ? 'animate-pulse' : ''
                      }`}
                      style={{ 
                        height: `${Math.random() * 80 + 20}%`,
                        animationDelay: `${i * 50}ms`
                      }}
                    />
                  ))}
                </div>
                {conversationStarted && (
                  <div className="text-center mt-4">
                    <p className="text-sm text-gray-600">
                      Your AI conversation partner is listening and ready to respond
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-center space-x-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  className="w-12 h-12 rounded-full"
                >
                  {isMuted ? (
                    <MicOff className="h-5 w-5 text-red-600" />
                  ) : (
                    <Mic className="h-5 w-5 text-gray-600" />
                  )}
                </Button>
                
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">
                    {isConnected ? 'Connected to AI' : 'Connecting...'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Speak naturally and wait for responses
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <RoomAudioRenderer />
        </div>
      </LiveKitRoomComponent>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conversation Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Speaking Tips:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Speak clearly and at a moderate pace</li>
                <li>• Pause between sentences</li>
                <li>• Ask questions to keep conversation flowing</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Listening Tips:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Wait for AI responses completely</li>
                <li>• Show engagement through responses</li>
                <li>• Build on what the AI says</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}