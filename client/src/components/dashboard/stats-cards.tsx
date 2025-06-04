import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionStats } from "@shared/schema";
import { BarChart3, Eye, Mic, Clock, TrendingUp } from "lucide-react";

interface StatsCardsProps {
  stats?: SessionStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-24 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const cards = [
    {
      title: "Total Sessions",
      value: stats.totalSessions.toString(),
      icon: BarChart3,
      color: "bg-blue-100 text-blue-600",
      improvement: `${stats.sessionsThisWeek} this week`,
      improvementColor: "text-green-600"
    },
    {
      title: "Avg Eye Contact",
      value: `${Math.round(stats.avgEyeContact * 100)}%`,
      icon: Eye,
      color: "bg-green-100 text-green-600",
      improvement: `+${Math.abs(stats.improvementPercent)}% improvement`,
      improvementColor: stats.improvementPercent >= 0 ? "text-green-600" : "text-red-600"
    },
    {
      title: "Voice Clarity",
      value: `${Math.round(stats.avgVoiceClarity * 100)}%`,
      icon: Mic,
      color: "bg-yellow-100 text-yellow-600",
      improvement: "from last month",
      improvementColor: "text-gray-600"
    },
    {
      title: "Practice Time",
      value: formatTime(stats.totalPracticeTime),
      icon: Clock,
      color: "bg-purple-100 text-purple-600",
      improvement: "total",
      improvementColor: "text-gray-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <Card key={index} className="border border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className={`h-4 w-4 mr-1 ${card.improvementColor}`} />
              <span className={`text-sm ${card.improvementColor} font-medium`}>
                {card.improvement}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
