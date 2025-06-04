import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";

export function ProgressChart() {
  const { data: sessions } = useQuery({
    queryKey: ["/api/sessions"],
  });

  // Process sessions data for chart (simplified version)
  const chartData = sessions?.slice(0, 7).reverse().map((session: any, index: number) => ({
    day: `Day ${index + 1}`,
    eyeContact: Math.round(session.eyeContactScore * 100),
    voiceClarity: Math.round(session.voiceClarity * 100),
    overall: Math.round(session.overallScore * 100)
  })) || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Progress Over Time</CardTitle>
        <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5">
          <option>Last 30 Days</option>
          <option>Last 90 Days</option>
          <option>Last Year</option>
        </select>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600">No data available yet</p>
              <p className="text-sm text-gray-500 mt-1">Complete more sessions to see your progress</p>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-end justify-between space-x-2 p-4">
            {chartData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center space-y-2">
                <div className="w-full bg-gray-100 rounded-lg relative h-32 flex flex-col justify-end">
                  <div 
                    className="bg-blue-500 rounded-t-lg"
                    style={{ height: `${(data.eyeContact / 100) * 100}%` }}
                    title={`Eye Contact: ${data.eyeContact}%`}
                  />
                  <div 
                    className="bg-green-500"
                    style={{ height: `${(data.voiceClarity / 100) * 30}%` }}
                    title={`Voice Clarity: ${data.voiceClarity}%`}
                  />
                  <div 
                    className="bg-yellow-500 rounded-b-lg"
                    style={{ height: `${(data.overall / 100) * 20}%` }}
                    title={`Overall: ${data.overall}%`}
                  />
                </div>
                <span className="text-xs text-gray-600">{data.day}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Legend */}
        <div className="flex justify-center space-x-6 mt-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
            <span>Eye Contact</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
            <span>Voice Clarity</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
            <span>Overall Score</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
