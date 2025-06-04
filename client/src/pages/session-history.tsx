import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Video, Play, Download, Trash2, Filter } from "lucide-react";

export default function SessionHistory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["/api/sessions"],
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      await apiRequest("DELETE", `/api/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/progress"] });
      toast({
        title: "Session Deleted",
        description: "The session has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete session. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleDeleteSession = (sessionId: number) => {
    if (confirm("Are you sure you want to delete this session?")) {
      deleteSessionMutation.mutate(sessionId);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "bg-green-100 text-green-800";
    if (score >= 0.6) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getGrade = (score: number) => {
    if (score >= 0.9) return "A+";
    if (score >= 0.8) return "A";
    if (score >= 0.7) return "B+";
    if (score >= 0.6) return "B";
    if (score >= 0.5) return "C+";
    return "C";
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Session History</h2>
          <p className="text-gray-600 mt-1">Review your past practice sessions</p>
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Recent Sessions
            <Badge variant="secondary">{sessions?.length || 0} total</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!sessions || sessions.length === 0 ? (
            <div className="text-center py-12">
              <Video className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h3>
              <p className="text-gray-600 mb-6">Start your first practice session to begin tracking your progress</p>
              <Button>Start Practice Session</Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sessions.map((session: any) => (
                <div key={session.id} className="py-6 hover:bg-gray-50 transition-colors rounded-lg px-4 -mx-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Video className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{session.title}</h4>
                        <p className="text-sm text-gray-600">
                          {new Date(session.createdAt).toLocaleDateString()} • {Math.floor(session.duration / 60)}m {session.duration % 60}s
                        </p>
                        <div className="flex items-center space-x-4 mt-2">
                          <Badge className={getScoreColor(session.eyeContactScore)}>
                            Eye Contact: {Math.round(session.eyeContactScore * 100)}%
                          </Badge>
                          <Badge className={getScoreColor(session.voiceClarity)}>
                            Voice: {getGrade(session.voiceClarity)}
                          </Badge>
                          <Badge className={getScoreColor(session.overallScore)}>
                            Overall: {Math.round(session.overallScore * 100)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-gray-600"
                        title="Play session"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-gray-600"
                        title="Download session"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => handleDeleteSession(session.id)}
                        disabled={deleteSessionMutation.isPending}
                        title="Delete session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
