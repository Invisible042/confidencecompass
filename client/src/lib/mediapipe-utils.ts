/**
 * MediaPipe Utilities
 * 
 * A collection of utility functions for working with MediaPipe Face Mesh
 * and other MediaPipe solutions. These utilities provide helper functions
 * for face detection, landmark processing, and visualization.
 * 
 * Key Features:
 * - Face mesh initialization
 * - Landmark processing
 * - Visualization helpers
 * - Performance optimization
 * - Error handling
 * 
 * Connections:
 * - MediaPipe Face Mesh: For face detection
 * - useEyeTracking: For eye tracking features
 * - useAdvancedEyeTracking: For advanced tracking
 * - Canvas API: For visualization
 * 
 * Usage:
 * These utilities are used throughout the application
 * for face tracking and analysis features.
 */

import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

export interface MediaPipeConfig {
  modelAssetPath: string;
  delegate: 'GPU' | 'CPU';
  runningMode: 'IMAGE' | 'VIDEO';
  maxNumFaces: number;
  refineLandmarks: boolean;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
}

export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface EyeContactMetrics {
  gazeDirection: {
    x: number;
    y: number;
    z: number;
  };
  eyeAspectRatio: {
    left: number;
    right: number;
  };
  pupilPosition: {
    left: { x: number; y: number };
    right: { x: number; y: number };
  };
  blinkRate: number;
  attentionScore: number;
  isLookingAtCamera: boolean;
  confidence: number;
}

export interface EyeGazeResult {
  landmarks: FaceLandmark[];
  eyeContactMetrics: EyeContactMetrics;
  faceDetected: boolean;
  processingTime: number;
}

export class MediaPipeEyeTracker {
  private faceMesh: FaceMesh | null = null;
  private initialized = false;
  private canvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  
  // Eye landmark indices from MediaPipe Face Mesh
  private readonly LEFT_EYE_LANDMARKS = [
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246
  ];
  
  private readonly RIGHT_EYE_LANDMARKS = [
    362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
  ];
  
  private readonly IRIS_LANDMARKS = {
    left: [468, 469, 470, 471, 472],
    right: [473, 474, 475, 476, 477]
  };
  
  // Blink detection history
  private blinkHistory: number[] = [];
  private lastBlinkTime = 0;
  private blinkCount = 0;

  constructor(private config: MediaPipeConfig) {}

  async initialize(): Promise<void> {
    try {
      this.faceMesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      this.faceMesh.setOptions({
        maxNumFaces: this.config.maxNumFaces,
        refineLandmarks: this.config.refineLandmarks,
        minDetectionConfidence: this.config.minDetectionConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence,
      });

      // Create canvas for processing
      this.canvas = document.createElement('canvas');
      this.canvasCtx = this.canvas.getContext('2d');
      
      this.initialized = true;
      console.log('MediaPipe Face Mesh initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MediaPipe Face Mesh:', error);
      throw error;
    }
  }

  async processFrame(videoElement: HTMLVideoElement): Promise<EyeGazeResult | null> {
    if (!this.initialized || !this.faceMesh || !this.canvas || !this.canvasCtx) {
      throw new Error('MediaPipe eye tracker not initialized');
    }

    const startTime = performance.now();

    return new Promise((resolve) => {
      this.faceMesh!.onResults((results) => {
        const processingTime = performance.now() - startTime;
        
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
          resolve({
            landmarks: [],
            eyeContactMetrics: this.getDefaultMetrics(),
            faceDetected: false,
            processingTime
          });
          return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        const eyeContactMetrics = this.calculateEyeContactMetrics(landmarks);
        
        resolve({
          landmarks: landmarks.map(landmark => ({
            x: landmark.x,
            y: landmark.y,
            z: landmark.z || 0,
            visibility: landmark.visibility
          })),
          eyeContactMetrics,
          faceDetected: true,
          processingTime
        });
      });

      // Process the frame
      this.faceMesh!.send({ image: videoElement });
    });
  }

  private calculateEyeContactMetrics(landmarks: any[]): EyeContactMetrics {
    // Calculate Eye Aspect Ratio (EAR) for blink detection
    const leftEAR = this.calculateEyeAspectRatio(landmarks, this.LEFT_EYE_LANDMARKS);
    const rightEAR = this.calculateEyeAspectRatio(landmarks, this.RIGHT_EYE_LANDMARKS);
    
    // Calculate pupil positions
    const leftPupil = this.calculatePupilPosition(landmarks, this.IRIS_LANDMARKS.left);
    const rightPupil = this.calculatePupilPosition(landmarks, this.IRIS_LANDMARKS.right);
    
    // Calculate gaze direction
    const gazeDirection = this.calculateGazeDirection(landmarks, leftPupil, rightPupil);
    
    // Update blink detection
    const avgEAR = (leftEAR + rightEAR) / 2;
    this.updateBlinkDetection(avgEAR);
    
    // Calculate attention score
    const attentionScore = this.calculateAttentionScore(gazeDirection, avgEAR);
    
    // Determine if looking at camera
    const isLookingAtCamera = this.isGazingAtCamera(gazeDirection, attentionScore);
    
    // Calculate confidence based on face visibility and landmark quality
    const confidence = this.calculateConfidence(landmarks, gazeDirection);

    return {
      gazeDirection,
      eyeAspectRatio: {
        left: leftEAR,
        right: rightEAR
      },
      pupilPosition: {
        left: leftPupil,
        right: rightPupil
      },
      blinkRate: this.calculateBlinkRate(),
      attentionScore,
      isLookingAtCamera,
      confidence
    };
  }

  private calculateEyeAspectRatio(landmarks: any[], eyeLandmarks: number[]): number {
    // Get eye landmarks
    const eyePoints = eyeLandmarks.map(idx => landmarks[idx]);
    
    // Calculate vertical distances
    const vertical1 = this.distance(eyePoints[1], eyePoints[5]);
    const vertical2 = this.distance(eyePoints[2], eyePoints[4]);
    
    // Calculate horizontal distance
    const horizontal = this.distance(eyePoints[0], eyePoints[3]);
    
    // EAR formula
    return (vertical1 + vertical2) / (2.0 * horizontal);
  }

  private calculatePupilPosition(landmarks: any[], irisLandmarks: number[]): { x: number; y: number } {
    if (irisLandmarks.length === 0) {
      return { x: 0.5, y: 0.5 };
    }
    
    // Calculate center of iris landmarks
    let x = 0, y = 0;
    for (const idx of irisLandmarks) {
      if (landmarks[idx]) {
        x += landmarks[idx].x;
        y += landmarks[idx].y;
      }
    }
    
    return {
      x: x / irisLandmarks.length,
      y: y / irisLandmarks.length
    };
  }

  private calculateGazeDirection(landmarks: any[], leftPupil: { x: number; y: number }, rightPupil: { x: number; y: number }): { x: number; y: number; z: number } {
    // Get face center and eye corners for reference
    const noseTip = landmarks[1]; // Nose tip
    const leftEyeCorner = landmarks[33]; // Left eye outer corner
    const rightEyeCorner = landmarks[362]; // Right eye outer corner
    
    // Calculate relative pupil positions
    const leftEyeCenter = landmarks[468] || leftEyeCorner;
    const rightEyeCenter = landmarks[473] || rightEyeCorner;
    
    // Calculate gaze direction based on pupil displacement
    const leftGazeX = (leftPupil.x - leftEyeCenter.x) * 2;
    const leftGazeY = (leftPupil.y - leftEyeCenter.y) * 2;
    
    const rightGazeX = (rightPupil.x - rightEyeCenter.x) * 2;
    const rightGazeY = (rightPupil.y - rightEyeCenter.y) * 2;
    
    // Average both eyes
    const gazeX = (leftGazeX + rightGazeX) / 2;
    const gazeY = (leftGazeY + rightGazeY) / 2;
    
    // Calculate Z component based on face angle
    const faceAngle = Math.atan2(rightEyeCorner.y - leftEyeCorner.y, rightEyeCorner.x - leftEyeCorner.x);
    const gazeZ = Math.sin(faceAngle) * 0.5;
    
    return { x: gazeX, y: gazeY, z: gazeZ };
  }

  private updateBlinkDetection(ear: number): void {
    const blinkThreshold = 0.2;
    const currentTime = Date.now();
    
    // Detect blink
    if (ear < blinkThreshold && (currentTime - this.lastBlinkTime) > 100) {
      this.blinkCount++;
      this.lastBlinkTime = currentTime;
    }
    
    // Keep EAR history for analysis
    this.blinkHistory.push(ear);
    if (this.blinkHistory.length > 30) { // Keep last 30 frames (~1 second at 30fps)
      this.blinkHistory.shift();
    }
  }

  private calculateBlinkRate(): number {
    const timeWindow = 60000; // 1 minute in milliseconds
    const currentTime = Date.now();
    
    // Reset blink count every minute
    if (currentTime - this.lastBlinkTime > timeWindow) {
      const rate = this.blinkCount;
      this.blinkCount = 0;
      return rate;
    }
    
    return this.blinkCount;
  }

  private calculateAttentionScore(gazeDirection: { x: number; y: number; z: number }, ear: number): number {
    // Combine gaze direction and blink patterns for attention score
    const gazeDistance = Math.sqrt(gazeDirection.x * gazeDirection.x + gazeDirection.y * gazeDirection.y);
    const gazeScore = Math.max(0, 1 - gazeDistance * 2); // Closer to center = higher score
    
    // Stable eye opening indicates attention
    const eyeStability = this.blinkHistory.length > 0 ? 
      1 - (this.calculateVariance(this.blinkHistory) * 10) : 0;
    
    // Combine factors
    return Math.max(0, Math.min(1, (gazeScore * 0.7 + eyeStability * 0.3)));
  }

  private isGazingAtCamera(gazeDirection: { x: number; y: number; z: number }, attentionScore: number): boolean {
    const gazeThreshold = 0.3;
    const attentionThreshold = 0.6;
    
    const gazeDistance = Math.sqrt(gazeDirection.x * gazeDirection.x + gazeDirection.y * gazeDirection.y);
    
    return gazeDistance < gazeThreshold && attentionScore > attentionThreshold;
  }

  private calculateConfidence(landmarks: any[], gazeDirection: { x: number; y: number; z: number }): number {
    // Base confidence on landmark quality and face visibility
    let confidence = 0.5;
    
    // Check if key landmarks are visible
    const keyLandmarks = [1, 33, 362, 468, 473]; // Nose tip, eye corners, iris centers
    const visibleLandmarks = keyLandmarks.filter(idx => 
      landmarks[idx] && (landmarks[idx].visibility === undefined || landmarks[idx].visibility > 0.5)
    ).length;
    
    confidence += (visibleLandmarks / keyLandmarks.length) * 0.4;
    
    // Stability of gaze direction
    const gazeStability = 1 - Math.min(1, Math.sqrt(gazeDirection.x * gazeDirection.x + gazeDirection.y * gazeDirection.y));
    confidence += gazeStability * 0.1;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private distance(point1: any, point2: any): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private getDefaultMetrics(): EyeContactMetrics {
    return {
      gazeDirection: { x: 0, y: 0, z: 0 },
      eyeAspectRatio: { left: 0.3, right: 0.3 },
      pupilPosition: { left: { x: 0.5, y: 0.5 }, right: { x: 0.5, y: 0.5 } },
      blinkRate: 0,
      attentionScore: 0,
      isLookingAtCamera: false,
      confidence: 0
    };
  }

  drawAnnotations(canvas: HTMLCanvasElement, result: EyeGazeResult): void {
    if (!result.faceDetected || !this.canvasCtx) return;
    
    canvas.width = canvas.width || 640;
    canvas.height = canvas.height || 480;
    
    this.canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    this.canvasCtx.drawImage(canvas, 0, 0);
    
    // Draw eye landmarks
    if (result.landmarks.length > 0) {
      this.canvasCtx.fillStyle = result.eyeContactMetrics.isLookingAtCamera ? '#00FF00' : '#FF0000';
      this.canvasCtx.strokeStyle = '#FFFFFF';
      this.canvasCtx.lineWidth = 1;
      
      // Draw left eye
      this.LEFT_EYE_LANDMARKS.forEach(idx => {
        if (result.landmarks[idx]) {
          const landmark = result.landmarks[idx];
          this.canvasCtx!.beginPath();
          this.canvasCtx!.arc(landmark.x * canvas.width, landmark.y * canvas.height, 2, 0, 2 * Math.PI);
          this.canvasCtx!.fill();
        }
      });
      
      // Draw right eye
      this.RIGHT_EYE_LANDMARKS.forEach(idx => {
        if (result.landmarks[idx]) {
          const landmark = result.landmarks[idx];
          this.canvasCtx!.beginPath();
          this.canvasCtx!.arc(landmark.x * canvas.width, landmark.y * canvas.height, 2, 0, 2 * Math.PI);
          this.canvasCtx!.fill();
        }
      });
      
      // Draw gaze direction indicator
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const gazeX = centerX + result.eyeContactMetrics.gazeDirection.x * 100;
      const gazeY = centerY + result.eyeContactMetrics.gazeDirection.y * 100;
      
      this.canvasCtx.strokeStyle = '#00FFFF';
      this.canvasCtx.lineWidth = 3;
      this.canvasCtx.beginPath();
      this.canvasCtx.moveTo(centerX, centerY);
      this.canvasCtx.lineTo(gazeX, gazeY);
      this.canvasCtx.stroke();
    }
  }

  destroy(): void {
    if (this.faceMesh) {
      this.faceMesh.close();
      this.faceMesh = null;
    }
    
    this.canvas = null;
    this.canvasCtx = null;
    this.initialized = false;
    this.blinkHistory = [];
    this.blinkCount = 0;
  }
}

export const createEyeTracker = (config: Partial<MediaPipeConfig> = {}) => {
  const defaultConfig: MediaPipeConfig = {
    modelAssetPath: '/models/face_landmarker.task',
    delegate: 'GPU',
    runningMode: 'VIDEO',
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  };

  return new MediaPipeEyeTracker({ ...defaultConfig, ...config });
};