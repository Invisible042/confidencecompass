import { useQuery } from "@tanstack/react-query";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ProgressChart } from "@/components/dashboard/progress-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Play, Video, History } from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: progressData, isLoading } = useQuery({
    queryKey: ["/api/user/progress"],
  });

  const { data: sessions } = useQuery({
    queryKey: ["/api/sessions"],
  });

  const recentSessions = sessions?.slice(0, 3) || [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
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
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Track your communication confidence progress</p>
        </div>
        <Button 
          onClick={() => setLocation("/practice")}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Play className="mr-2 h-4 w-4" />
          Start Practice
        </Button>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={progressData?.stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Chart */}
        <div className="lg:col-span-2">
          <ProgressChart />
        </div>

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentSessions.length === 0 ? (
              <div className="text-center py-8">
                <Video className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600">No sessions yet</p>
                <p className="text-sm text-gray-500 mt-1">Start your first practice session to see progress</p>
              </div>
            ) : (
              recentSessions.map((session: any) => (
                <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Video className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{session.title}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {Math.round(session.overallScore)}%
                    </p>
                    <p className="text-xs text-gray-500">
                      {Math.floor(session.duration / 60)}m {session.duration % 60}s
                    </p>
                  </div>
                </div>
              ))
            )}
            
            {recentSessions.length > 0 && (
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => setLocation("/history")}
              >
                <History className="mr-2 h-4 w-4" />
                View All Sessions
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="flex items-center space-x-3 p-4 h-auto justify-start hover:border-blue-300 hover:bg-blue-50"
              onClick={() => setLocation("/practice")}
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Video className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Free Practice</p>
                <p className="text-sm text-gray-500">Start an unguided session</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="flex items-center space-x-3 p-4 h-auto justify-start hover:border-green-300 hover:bg-green-50"
              onClick={() => setLocation("/practice")}
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Play className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Guided Practice</p>
                <p className="text-sm text-gray-500">Follow structured exercises</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="flex items-center space-x-3 p-4 h-auto justify-start hover:border-purple-300 hover:bg-purple-50"
              onClick={() => setLocation("/history")}
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <History className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Review Sessions</p>
                <p className="text-sm text-gray-500">Watch previous recordings</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
