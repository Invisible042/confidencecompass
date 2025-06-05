import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConversationTopic } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Users, Brain, Mic, Video } from "lucide-react";
import { LiveKitRoom } from "@/components/conversation/livekit-room";

export default function AIConversation() {
  const [selectedTopic, setSelectedTopic] = useState<ConversationTopic | null>(null);
  const [isInConversation, setIsInConversation] = useState(false);
  const [roomData, setRoomData] = useState<any>(null);
  const { toast } = useToast();

  const { data: topics, isLoading } = useQuery({
    queryKey: ["/api/conversation/topics"],
  });

  const createRoomMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const response = await apiRequest("POST", "/api/conversation/create-room", { topicId });
      return response.json();
    },
    onSuccess: (data) => {
      setRoomData(data);
      setIsInConversation(true);
      toast({
        title: "Conversation Started",
        description: "You're now connected with your AI conversation partner.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start conversation. Please try again.",
        variant: "destructive",
      });
    }
  });

  const startConversation = (topic: ConversationTopic) => {
    setSelectedTopic(topic);
    createRoomMutation.mutate(topic.id);
  };

  const endConversation = () => {
    setIsInConversation(false);
    setRoomData(null);
    setSelectedTopic(null);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Professional': return Users;
      case 'Social': return MessageCircle;
      default: return Brain;
    }
  };

  if (isInConversation && roomData) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Conversation</h2>
            <p className="text-gray-600 mt-1">{selectedTopic?.title}</p>
          </div>
          <Button 
            onClick={endConversation}
            variant="destructive"
          >
            End Conversation
          </Button>
        </div>

        <LiveKitRoom 
          roomData={roomData}
          topic={selectedTopic!}
          onEnd={endConversation}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">AI Conversation Practice</h2>
        <p className="text-gray-600 mt-1">Practice real conversations with AI partners on various topics</p>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {topics?.map((topic: ConversationTopic) => {
          const CategoryIcon = getCategoryIcon(topic.category);
          
          return (
            <Card key={topic.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-blue-100`}>
                    <CategoryIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <Badge className={getDifficultyColor(topic.difficulty)}>
                    {topic.difficulty}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{topic.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600 text-sm">{topic.description}</p>
                
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{topic.category}</Badge>
                  <Button 
                    onClick={() => startConversation(topic)}
                    disabled={createRoomMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    Start Chat
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Features Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="mr-2 h-5 w-5" />
            How AI Conversation Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Mic className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Natural Speech</h4>
              <p className="text-sm text-gray-600">Speak naturally and get real-time responses from your AI conversation partner</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Brain className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Smart Responses</h4>
              <p className="text-sm text-gray-600">AI adapts to conversation topics and provides contextual, helpful responses</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Video className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Real-time Analysis</h4>
              <p className="text-sm text-gray-600">Get feedback on your communication skills during the conversation</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}