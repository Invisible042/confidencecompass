import { useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Eye, Target, Activity, RotateCw } from "lucide-react";

interface FaceTrackingData {
  eyeContact: {
    x: number;
    y: number;
    confidence: number;
    timestamp: number;
  };
  headPose: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  eyeOpenness: {
    left: number;
    right: number;
  };
  blinkRate: number;
  faceLandmarks: Array<{ x: number; y: number; z?: number }>;
  faceDetected: boolean;
}

interface FaceTrackingDisplayProps {
  faceTrackingData: FaceTrackingData | null;
  confidence: number;
  isActive: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function FaceTrackingDisplay({ 
  faceTrackingData, 
  confidence, 
  isActive, 
  videoRef 
}: FaceTrackingDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw face landmarks and gaze visualization
  useEffect(() => {
    if (!faceTrackingData || !canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw face landmarks
    if (faceTrackingData.faceLandmarks.length > 0) {
      drawFaceLandmarks(ctx, faceTrackingData.faceLandmarks, canvas.width, canvas.height);
    }

    // Draw gaze indicator
    drawGazeIndicator(ctx, faceTrackingData.eyeContact, canvas.width, canvas.height);

    // Draw head pose indicator
    drawHeadPose(ctx, faceTrackingData.headPose, canvas.width, canvas.height);

  }, [faceTrackingData, videoRef]);

  const drawFaceLandmarks = (
    ctx: CanvasRenderingContext2D, 
    landmarks: Array<{ x: number; y: number; z?: number }>,
    width: number,
    height: number
  ) => {
    // Draw key facial landmarks
    ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
    
    landmarks.forEach((landmark, index) => {
      const x = landmark.x * width;
      const y = landmark.y * height;
      
      // Draw different sizes for different landmark types
      let radius = 1;
      
      // Eye landmarks (larger)
      if ((index >= 33 && index <= 46) || (index >= 362 && index <= 398)) {
        radius = 2;
        ctx.fillStyle = 'rgba(0, 100, 255, 0.8)';
      }
      // Lip landmarks
      else if (index >= 61 && index <= 291) {
        radius = 1.5;
        ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
      }
      // Nose and face outline
      else {
        radius = 1;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.4)';
      }
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  const drawGazeIndicator = (
    ctx: CanvasRenderingContext2D,
    eyeContact: { x: number; y: number; confidence: number },
    width: number,
    height: number
  ) => {
    // Draw gaze point
    const gazeX = eyeContact.x * width;
    const gazeY = eyeContact.y * height;
    
    // Draw gaze target
    ctx.strokeStyle = `rgba(255, 0, 0, ${eyeContact.confidence})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(gazeX, gazeY, 20, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw crosshair at gaze point
    ctx.beginPath();
    ctx.moveTo(gazeX - 15, gazeY);
    ctx.lineTo(gazeX + 15, gazeY);
    ctx.moveTo(gazeX, gazeY - 15);
    ctx.lineTo(gazeX, gazeY + 15);
    ctx.stroke();
    
    // Draw center target (camera position)
    const centerX = width / 2;
    const centerY = height / 2;
    
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw line from gaze to center
    ctx.strokeStyle = `rgba(255, 255, 0, ${eyeContact.confidence * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gazeX, gazeY);
    ctx.lineTo(centerX, centerY);
    ctx.stroke();
  };

  const drawHeadPose = (
    ctx: CanvasRenderingContext2D,
    headPose: { pitch: number; yaw: number; roll: number },
    width: number,
    height: number
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Draw head pose indicators
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    
    // Yaw indicator (left/right)
    const yawLength = Math.abs(headPose.yaw) * 2;
    const yawDirection = headPose.yaw > 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 40);
    ctx.lineTo(centerX + (yawDirection * yawLength), centerY - 40);
    ctx.stroke();
    
    // Pitch indicator (up/down)
    const pitchLength = Math.abs(headPose.pitch) * 2;
    const pitchDirection = headPose.pitch > 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(centerX - 40, centerY);
    ctx.lineTo(centerX - 40, centerY + (pitchDirection * pitchLength));
    ctx.stroke();
  };

  const getEyeContactStatus = () => {
    if (!faceTrackingData) return "No face detected";
    
    const gazeX = faceTrackingData.eyeContact.x;
    const gazeY = faceTrackingData.eyeContact.y;
    const centerThreshold = 0.15;
    
    const isLookingAtCamera = 
      Math.abs(gazeX - 0.5) < centerThreshold && 
      Math.abs(gazeY - 0.5) < centerThreshold;
    
    if (isLookingAtCamera && confidence > 0.7) {
      return "Excellent eye contact";
    } else if (isLookingAtCamera && confidence > 0.5) {
      return "Good eye contact";
    } else if (confidence > 0.5) {
      return "Looking away";
    } else {
      return "Poor detection";
    }
  };

  const getHeadPoseStatus = () => {
    if (!faceTrackingData) return "Unknown";
    
    const { pitch, yaw, roll } = faceTrackingData.headPose;
    const threshold = 15; // degrees
    
    if (Math.abs(pitch) < threshold && Math.abs(yaw) < threshold && Math.abs(roll) < threshold) {
      return "Optimal position";
    } else if (Math.abs(yaw) > threshold) {
      return yaw > 0 ? "Head turned right" : "Head turned left";
    } else if (Math.abs(pitch) > threshold) {
      return pitch > 0 ? "Looking down" : "Looking up";
    } else {
      return "Head tilted";
    }
  };

  const getBlinkStatus = () => {
    if (!faceTrackingData) return "Unknown";
    
    const rate = faceTrackingData.blinkRate;
    if (rate < 10) return "Low blink rate";
    if (rate > 25) return "High blink rate";
    return "Normal blink rate";
  };

  return (
    <div className="space-y-4">
      {/* Face tracking overlay */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
          style={{ 
            maxWidth: '100%',
            height: 'auto',
            aspectRatio: '4/3'
          }}
        />
      </div>

      {/* Face tracking metrics */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Eye Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={confidence > 0.7 ? "default" : confidence > 0.5 ? "secondary" : "destructive"}>
                {getEyeContactStatus()}
              </Badge>
            </div>
            <Progress value={confidence * 100} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Confidence: {Math.round(confidence * 100)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4" />
              Head Position
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pose</span>
              <Badge variant="outline">
                {getHeadPoseStatus()}
              </Badge>
            </div>
            {faceTrackingData && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Yaw:</span>
                  <span>{Math.round(faceTrackingData.headPose.yaw)}°</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Pitch:</span>
                  <span>{Math.round(faceTrackingData.headPose.pitch)}°</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Eye Movement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {faceTrackingData && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Left Eye:</span>
                  <Progress value={faceTrackingData.eyeOpenness.left * 100} className="w-16 h-2" />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Right Eye:</span>
                  <Progress value={faceTrackingData.eyeOpenness.right * 100} className="w-16 h-2" />
                </div>
                <div className="text-xs text-muted-foreground">
                  {getBlinkStatus()} ({Math.round(faceTrackingData.blinkRate)}/min)
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <RotateCw className="w-4 h-4" />
              Detection Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            {faceTrackingData && (
              <>
                <Progress value={confidence * 100} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  Landmarks: {faceTrackingData.faceLandmarks.length}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}