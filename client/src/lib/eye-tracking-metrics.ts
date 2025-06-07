/**
 * EyeTrackingMetrics
 * 
 * A utility class for calculating and processing eye tracking metrics.
 * This class provides methods for analyzing eye movements, blinks,
 * and gaze patterns during conversation practice.
 * 
 * Key Features:
 * - Eye contact detection
 * - Blink rate calculation
 * - Gaze direction analysis
 * - Saccade detection
 * - Fixation analysis
 * 
 * Connections:
 * - MediaPipe Face Mesh: For facial landmark data
 * - useEyeTracking: For real-time metrics
 * - IntegrationService: For combining with other metrics
 * 
 * Usage:
 * This class is used by both basic and advanced eye tracking hooks
 * to process and analyze eye tracking data.
 */

import { EyeTrackingPoint } from "@shared/schema";

export interface GazeMetrics {
  fixations: Array<{
    x: number;
    y: number;
    duration: number;
    startTime: number;
  }>;
  saccades: Array<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    duration: number;
    velocity: number;
  }>;
  heatmap: {
    points: Array<{ x: number; y: number; intensity: number }>;
    resolution: number;
  };
}

export interface CalibrationData {
  screenSize: { width: number; height: number };
  userDistance: number;
  calibrationPoints: Array<{
    x: number;
    y: number;
    timestamp: number;
  }>;
}

export class EyeTrackingAnalyzer {
  private readonly FIXATION_THRESHOLD = 0.1; // pixels
  private readonly FIXATION_DURATION = 100; // ms
  private readonly HEATMAP_DECAY = 0.95;
  
  private currentFixation: {
    x: number;
    y: number;
    startTime: number;
  } | null = null;
  
  private lastGazePoint: EyeTrackingPoint | null = null;
  private heatmapPoints: Array<{ x: number; y: number; intensity: number }> = [];
  
  constructor(private config: {
    screenWidth: number;
    screenHeight: number;
    userDistance: number;
  }) {}

  public analyzeGazePattern(eyeTrackingData: EyeTrackingPoint[]): GazeMetrics {
    const fixations: GazeMetrics['fixations'] = [];
    const saccades: GazeMetrics['saccades'] = [];
    
    for (let i = 1; i < eyeTrackingData.length; i++) {
      const current = eyeTrackingData[i];
      const previous = eyeTrackingData[i - 1];
      
      // Calculate movement
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Update heatmap
      this.updateHeatmap(current.x, current.y);
      
      if (distance < this.FIXATION_THRESHOLD) {
        // Potential fixation
        if (!this.currentFixation) {
          this.currentFixation = {
            x: current.x,
            y: current.y,
            startTime: current.timestamp
          };
        } else if (current.timestamp - this.currentFixation.startTime >= this.FIXATION_DURATION) {
          // Confirmed fixation
          fixations.push({
            x: this.currentFixation.x,
            y: this.currentFixation.y,
            duration: current.timestamp - this.currentFixation.startTime,
            startTime: this.currentFixation.startTime
          });
        }
      } else {
        // Saccade detected
        if (this.currentFixation) {
          saccades.push({
            startX: this.currentFixation.x,
            startY: this.currentFixation.y,
            endX: current.x,
            endY: current.y,
            duration: current.timestamp - this.currentFixation.startTime,
            velocity: distance / (current.timestamp - this.currentFixation.startTime)
          });
          this.currentFixation = null;
        }
      }
      
      this.lastGazePoint = current;
    }
    
    return {
      fixations,
      saccades,
      heatmap: {
        points: this.heatmapPoints,
        resolution: 50 // 50x50 grid
      }
    };
  }
  
  private updateHeatmap(x: number, y: number): void {
    // Add new point
    this.heatmapPoints.push({ x, y, intensity: 1.0 });
    
    // Decay existing points
    this.heatmapPoints = this.heatmapPoints
      .map(point => ({
        ...point,
        intensity: point.intensity * this.HEATMAP_DECAY
      }))
      .filter(point => point.intensity > 0.1);
  }
  
  public calibrate(calibrationPoints: CalibrationData['calibrationPoints']): void {
    // Calculate average distance and adjust thresholds
    const distances = calibrationPoints.map((point, i) => {
      if (i === 0) return 0;
      const prev = calibrationPoints[i - 1];
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      return Math.sqrt(dx * dx + dy * dy);
    });
    
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    this.FIXATION_THRESHOLD = avgDistance * 0.1;
  }
}

// Create a worker for eye tracking
const eyeTrackingWorker = PerformanceOptimizer.createWebWorker(`
  importScripts('eye-tracking-metrics.js');
  self.onmessage = async (e) => {
    const result = await EyeTrackingAnalyzer.processFrame(e.data);
    self.postMessage(result);
  };
`);

// Create a worker for voice analysis
const voiceAnalysisWorker = PerformanceOptimizer.createWebWorker(`
  importScripts('voice-analysis-service.js');
  self.onmessage = async (e) => {
    const result = await VoiceAnalysisService.analyzeVoice(e.data);
    self.postMessage(result);
  };
`); 