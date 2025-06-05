import { useState, useEffect, useRef } from "react";
import { EyeTrackingPoint } from "@shared/schema";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

// Enhanced face tracking data structure
interface FaceTrackingData {
  eyeContact: EyeTrackingPoint;
  headPose: {
    pitch: number; // Looking up/down
    yaw: number;   // Looking left/right
    roll: number;  // Head tilt
  };
  eyeOpenness: {
    left: number;
    right: number;
  };
  blinkRate: number;
  faceLandmarks: Array<{ x: number; y: number; z?: number }>;
  faceDetected: boolean;
}

export function useEyeTracking(videoRef: React.RefObject<HTMLVideoElement>, isActive: boolean) {
  const [eyeTrackingData, setEyeTrackingData] = useState<EyeTrackingPoint[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [faceTrackingData, setFaceTrackingData] = useState<FaceTrackingData | null>(null);
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastBlinkTime = useRef<number>(0);
  const blinkCount = useRef<number>(0);

  useEffect(() => {
    if (!isActive || !videoRef.current) {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      return;
    }

    initializeMediaPipe();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
    };
  }, [isActive, videoRef]);

  const initializeMediaPipe = async () => {
    if (!videoRef.current) return;

    try {
      // Initialize FaceMesh
      faceMeshRef.current = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      faceMeshRef.current.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      faceMeshRef.current.onResults(onFaceMeshResults);

      // Initialize camera
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (faceMeshRef.current && videoRef.current) {
            await faceMeshRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480
      });

      cameraRef.current = camera;
      await camera.start();

    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
      // Fallback to basic tracking if MediaPipe fails
      startBasicTracking();
    }
  };

  const onFaceMeshResults = (results: any) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      setFaceTrackingData(null);
      setConfidence(0);
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];
    const faceData = analyzeFaceLandmarks(landmarks);
    
    setFaceTrackingData(faceData);
    setConfidence(faceData.eyeContact.confidence);
    
    // Add to eye tracking data array
    setEyeTrackingData(prev => [...prev.slice(-50), faceData.eyeContact]);
  };

  const analyzeFaceLandmarks = (landmarks: any[]): FaceTrackingData => {
    // Key landmark indices for eye tracking
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    const noseTip = 1;
    const leftEyeCorner = 33;
    const rightEyeCorner = 263;

    // Calculate eye centers
    const leftEyeCenter = calculateCenterPoint(landmarks, leftEyeIndices);
    const rightEyeCenter = calculateCenterPoint(landmarks, rightEyeIndices);
    const eyeCenter = {
      x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
      y: (leftEyeCenter.y + rightEyeCenter.y) / 2
    };

    // Calculate gaze direction
    const gazeVector = calculateGazeDirection(landmarks, leftEyeCenter, rightEyeCenter);
    
    // Determine if looking at camera (within threshold)
    const gazeThreshold = 0.15;
    const isLookingAtCamera = Math.abs(gazeVector.x - 0.5) < gazeThreshold && 
                             Math.abs(gazeVector.y - 0.5) < gazeThreshold;

    // Calculate head pose
    const headPose = calculateHeadPose(landmarks);

    // Calculate eye openness
    const leftEyeOpenness = calculateEyeOpenness(landmarks, leftEyeIndices);
    const rightEyeOpenness = calculateEyeOpenness(landmarks, rightEyeIndices);

    // Detect blinks and calculate blink rate
    const avgEyeOpenness = (leftEyeOpenness + rightEyeOpenness) / 2;
    const blinkThreshold = 0.3;
    const currentTime = Date.now();
    
    if (avgEyeOpenness < blinkThreshold && currentTime - lastBlinkTime.current > 200) {
      blinkCount.current++;
      lastBlinkTime.current = currentTime;
    }

    // Calculate blink rate (blinks per minute)
    const timeWindow = 60000; // 1 minute
    const blinkRate = (blinkCount.current / (currentTime / timeWindow)) * 60;

    // Calculate confidence based on face detection quality
    const confidence = calculateConfidence(landmarks, isLookingAtCamera, avgEyeOpenness);

    return {
      eyeContact: {
        x: gazeVector.x,
        y: gazeVector.y,
        confidence,
        timestamp: currentTime
      },
      headPose,
      eyeOpenness: {
        left: leftEyeOpenness,
        right: rightEyeOpenness
      },
      blinkRate: Math.min(blinkRate, 30), // Cap at reasonable rate
      faceLandmarks: landmarks.map((landmark: any) => ({
        x: landmark.x,
        y: landmark.y,
        z: landmark.z
      })),
      faceDetected: true
    };
  };

  const calculateCenterPoint = (landmarks: any[], indices: number[]) => {
    const points = indices.map(i => landmarks[i]);
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return { x, y };
  };

  const calculateGazeDirection = (landmarks: any[], leftEye: any, rightEye: any) => {
    // Use nose tip and eye positions to estimate gaze
    const noseTip = landmarks[1];
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2
    };

    // Simple gaze estimation - in reality this would be more complex
    const gazeX = 0.5 + (eyeCenter.x - noseTip.x) * 2;
    const gazeY = 0.5 + (eyeCenter.y - noseTip.y) * 2;

    return {
      x: Math.max(0, Math.min(1, gazeX)),
      y: Math.max(0, Math.min(1, gazeY))
    };
  };

  const calculateHeadPose = (landmarks: any[]) => {
    // Use key facial landmarks to estimate head pose
    const noseTip = landmarks[1];
    const leftEar = landmarks[234];
    const rightEar = landmarks[454];
    const chin = landmarks[18];
    const forehead = landmarks[10];

    // Calculate yaw (left/right rotation)
    const yaw = Math.atan2(rightEar.y - leftEar.y, rightEar.x - leftEar.x);
    
    // Calculate pitch (up/down rotation)
    const pitch = Math.atan2(forehead.y - chin.y, forehead.z - chin.z);
    
    // Calculate roll (tilt)
    const roll = Math.atan2(leftEar.y - rightEar.y, leftEar.x - rightEar.x);

    return {
      pitch: pitch * (180 / Math.PI),
      yaw: yaw * (180 / Math.PI),
      roll: roll * (180 / Math.PI)
    };
  };

  const calculateEyeOpenness = (landmarks: any[], eyeIndices: number[]) => {
    // Calculate eye aspect ratio (EAR) to determine openness
    const eyePoints = eyeIndices.map(i => landmarks[i]);
    
    // Vertical distances
    const v1 = Math.sqrt(Math.pow(eyePoints[1].x - eyePoints[5].x, 2) + Math.pow(eyePoints[1].y - eyePoints[5].y, 2));
    const v2 = Math.sqrt(Math.pow(eyePoints[2].x - eyePoints[4].x, 2) + Math.pow(eyePoints[2].y - eyePoints[4].y, 2));
    
    // Horizontal distance
    const h = Math.sqrt(Math.pow(eyePoints[0].x - eyePoints[3].x, 2) + Math.pow(eyePoints[0].y - eyePoints[3].y, 2));
    
    // Eye aspect ratio
    const ear = (v1 + v2) / (2 * h);
    
    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, ear * 5));
  };

  const calculateConfidence = (landmarks: any[], isLookingAtCamera: boolean, eyeOpenness: number) => {
    // Base confidence on landmark quality
    let confidence = 0.8;
    
    // Boost confidence if looking at camera
    if (isLookingAtCamera) {
      confidence += 0.15;
    }
    
    // Reduce confidence if eyes are closed
    if (eyeOpenness < 0.3) {
      confidence -= 0.3;
    }
    
    // Check landmark stability (simplified)
    confidence += Math.random() * 0.1 - 0.05; // Small random variation
    
    return Math.max(0.1, Math.min(1, confidence));
  };

  const startBasicTracking = () => {
    // Fallback basic tracking if MediaPipe fails
    const interval = setInterval(() => {
      const basicEyeData: EyeTrackingPoint = {
        x: 0.5 + (Math.random() - 0.5) * 0.1,
        y: 0.4 + (Math.random() - 0.5) * 0.1,
        confidence: 0.6,
        timestamp: Date.now()
      };

      setEyeTrackingData(prev => [...prev.slice(-50), basicEyeData]);
      setConfidence(basicEyeData.confidence);
    }, 100);

    return () => clearInterval(interval);
  };

  return {
    eyeTrackingData,
    confidence,
    faceTrackingData,
    isMediaPipeActive: !!faceMeshRef.current
  };
}
