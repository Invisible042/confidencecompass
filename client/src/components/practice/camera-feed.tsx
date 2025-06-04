import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EyeTrackingPoint } from "@shared/schema";

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  eyeTrackingData: EyeTrackingPoint[];
  confidence: number;
  sessionTimer: string;
}

export function CameraFeed({ 
  videoRef, 
  isActive, 
  eyeTrackingData, 
  confidence, 
  sessionTimer 
}: CameraFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || eyeTrackingData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw eye tracking points
    const latestPoint = eyeTrackingData[eyeTrackingData.length - 1];
    if (latestPoint) {
      ctx.fillStyle = confidence > 0.7 ? "#10B981" : "#F59E0B";
      ctx.beginPath();
      ctx.arc(latestPoint.x * canvas.width, latestPoint.y * canvas.height, 8, 0, 2 * Math.PI);
      ctx.fill();

      // Draw confidence indicator
      ctx.strokeStyle = confidence > 0.7 ? "#10B981" : "#F59E0B";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(latestPoint.x * canvas.width, latestPoint.y * canvas.height, 20, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }, [eyeTrackingData, confidence]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Camera Feed & Eye Tracking
          {isActive && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-red-600">Recording</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Eye tracking overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            width={640}
            height={480}
          />

          {/* Eye Contact Indicator */}
          <div className="absolute top-4 left-4">
            <div className="flex items-center space-x-2 bg-black bg-opacity-50 rounded-lg px-3 py-2">
              <div 
                className={`w-3 h-3 rounded-full ${
                  confidence > 0.7 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                }`}
              />
              <span className="text-white text-sm font-medium">
                {confidence > 0.7 ? 'Eye Contact Detected' : 'Look at Camera'}
              </span>
            </div>
          </div>

          {/* Session Timer */}
          {isActive && (
            <div className="absolute top-4 right-4">
              <div className="bg-black bg-opacity-50 rounded-lg px-3 py-2">
                <span className="text-white text-sm font-medium">{sessionTimer}</span>
              </div>
            </div>
          )}

          {/* Confidence Score */}
          <div className="absolute bottom-4 left-4">
            <div className="bg-black bg-opacity-50 rounded-lg px-3 py-2">
              <span className="text-white text-sm font-medium">Confidence: </span>
              <span className="text-green-400 text-sm font-bold">
                {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>

          {/* No video placeholder */}
          {!videoRef.current?.srcObject && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-600 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-lg">Camera feed will appear here</p>
                <p className="text-sm opacity-75 mt-1">Grant camera permission to start</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
