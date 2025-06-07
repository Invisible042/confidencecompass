import { EyeTrackingAnalyzer, GazeMetrics } from './eye-tracking-metrics';
import { VoiceMetrics } from '../server/voice-analysis-service';

/**
 * IntegrationService
 * 
 * A service that combines and analyzes data from multiple sources to provide
 * comprehensive feedback on conversation practice performance. This service
 * integrates voice analysis, eye tracking, and other metrics to generate
 * meaningful insights and recommendations.
 * 
 * Key Features:
 * - Multi-metric integration
 * - Performance scoring
 * - Real-time analysis
 * - Recommendation generation
 * - Progress tracking
 * 
 * Connections:
 * - EnhancedVoiceAnalyzer: For voice metrics
 * - EyeTrackingMetrics: For eye tracking data
 * - PracticeSession: For session context
 * - RecommendationEngine: For feedback generation
 * 
 * Usage:
 * This service is used to provide comprehensive feedback
 * during and after conversation practice sessions.
 */

export interface EngagementMetrics {
  overallScore: number;
  eyeContact: {
    score: number;
    attentionLevel: number;
    gazePattern: GazeMetrics;
  };
  voice: {
    score: number;
    confidence: number;
    metrics: VoiceMetrics;
  };
  combined: {
    attentionConsistency: number;
    engagementTrend: number;
    recommendations: string[];
  };
}

export class IntegrationService {
  private readonly ATTENTION_WEIGHT = 0.4;
  private readonly VOICE_WEIGHT = 0.4;
  private readonly COMBINED_WEIGHT = 0.2;
  
  private readonly MIN_ATTENTION_THRESHOLD = 0.6;
  private readonly MIN_VOICE_CONFIDENCE = 0.7;
  
  constructor(
    private eyeTracker: EyeTrackingAnalyzer,
    private config: {
      enableRealTimeAnalysis: boolean;
      analysisWindow: number; // ms
    }
  ) {}

  public analyzeEngagement(
    eyeTrackingData: any[],
    voiceMetrics: VoiceMetrics
  ): EngagementMetrics {
    const gazeMetrics = this.eyeTracker.analyzeGazePattern(eyeTrackingData);
    
    const eyeContactScore = this.calculateEyeContactScore(gazeMetrics);
    const voiceScore = this.calculateVoiceScore(voiceMetrics);
    const combinedScore = this.calculateCombinedScore(gazeMetrics, voiceMetrics);
    
    const overallScore = (
      eyeContactScore * this.ATTENTION_WEIGHT +
      voiceScore * this.VOICE_WEIGHT +
      combinedScore * this.COMBINED_WEIGHT
    );
    
    const recommendations = this.generateRecommendations(
      gazeMetrics,
      voiceMetrics,
      overallScore
    );
    
    return {
      overallScore,
      eyeContact: {
        score: eyeContactScore,
        attentionLevel: this.calculateAttentionLevel(gazeMetrics),
        gazePattern: gazeMetrics
      },
      voice: {
        score: voiceScore,
        confidence: this.calculateVoiceConfidence(voiceMetrics),
        metrics: voiceMetrics
      },
      combined: {
        attentionConsistency: this.calculateAttentionConsistency(gazeMetrics, voiceMetrics),
        engagementTrend: this.calculateEngagementTrend(eyeTrackingData, voiceMetrics),
        recommendations
      }
    };
  }

  private calculateEyeContactScore(gazeMetrics: GazeMetrics): number {
    const fixationScore = this.calculateFixationScore(gazeMetrics.fixations);
    const saccadeScore = this.calculateSaccadeScore(gazeMetrics.saccades);
    const heatmapScore = this.calculateHeatmapScore(gazeMetrics.heatmap);
    
    return (fixationScore * 0.4 + saccadeScore * 0.3 + heatmapScore * 0.3);
  }

  private calculateVoiceScore(voiceMetrics: VoiceMetrics): number {
    const fillerWordScore = 1 - (voiceMetrics.fillerWords.rate / 10); // Normalize to 0-1
    const speechRateScore = this.normalizeSpeechRate(voiceMetrics.speechRate.wordsPerMinute);
    const tremorScore = 1 - (voiceMetrics.voiceTremor.intensity || 0);
    const emotionScore = voiceMetrics.emotion.confidence;
    
    return (
      fillerWordScore * 0.3 +
      speechRateScore * 0.3 +
      tremorScore * 0.2 +
      emotionScore * 0.2
    );
  }

  private calculateCombinedScore(
    gazeMetrics: GazeMetrics,
    voiceMetrics: VoiceMetrics
  ): number {
    const attentionConsistency = this.calculateAttentionConsistency(gazeMetrics, voiceMetrics);
    const engagementTrend = this.calculateEngagementTrend([], voiceMetrics);
    
    return (attentionConsistency * 0.6 + engagementTrend * 0.4);
  }

  private calculateAttentionLevel(gazeMetrics: GazeMetrics): number {
    const totalDuration = gazeMetrics.fixations.reduce(
      (sum, fix) => sum + fix.duration, 0
    );
    const totalTime = this.config.analysisWindow;
    
    return Math.min(1, totalDuration / totalTime);
  }

  private calculateVoiceConfidence(voiceMetrics: VoiceMetrics): number {
    const fillerWordConfidence = voiceMetrics.fillerWords.words.reduce(
      (sum, word) => sum + word.confidence, 0
    ) / voiceMetrics.fillerWords.words.length;
    
    const emotionConfidence = voiceMetrics.emotion.confidence;
    
    return (fillerWordConfidence * 0.6 + emotionConfidence * 0.4);
  }

  private calculateAttentionConsistency(
    gazeMetrics: GazeMetrics,
    voiceMetrics: VoiceMetrics
  ): number {
    const eyeAttention = this.calculateAttentionLevel(gazeMetrics);
    const voiceAttention = 1 - (voiceMetrics.fillerWords.rate / 10);
    
    return 1 - Math.abs(eyeAttention - voiceAttention);
  }

  private calculateEngagementTrend(
    eyeTrackingData: any[],
    voiceMetrics: VoiceMetrics
  ): number {
    // Implement trend analysis over time
    // This is a simplified version
    return 0.5;
  }

  private generateRecommendations(
    gazeMetrics: GazeMetrics,
    voiceMetrics: VoiceMetrics,
    overallScore: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (overallScore < this.MIN_ATTENTION_THRESHOLD) {
      recommendations.push("Try to maintain more consistent eye contact");
    }
    
    if (voiceMetrics.fillerWords.rate > 5) {
      recommendations.push("Consider reducing filler words in your speech");
    }
    
    if (voiceMetrics.voiceTremor.detected) {
      recommendations.push("Try to speak more steadily and confidently");
    }
    
    if (voiceMetrics.speechRate.wordsPerMinute > 160) {
      recommendations.push("Consider speaking at a slightly slower pace");
    }
    
    return recommendations;
  }

  private calculateFixationScore(fixations: GazeMetrics['fixations']): number {
    if (fixations.length === 0) return 0;
    
    const avgDuration = fixations.reduce((sum, fix) => sum + fix.duration, 0) / fixations.length;
    const maxDuration = Math.max(...fixations.map(fix => fix.duration));
    
    return (avgDuration / maxDuration) * 0.7 + 0.3;
  }

  private calculateSaccadeScore(saccades: GazeMetrics['saccades']): number {
    if (saccades.length === 0) return 0;
    
    const avgVelocity = saccades.reduce((sum, sac) => sum + sac.velocity, 0) / saccades.length;
    const maxVelocity = Math.max(...saccades.map(sac => sac.velocity));
    
    return (avgVelocity / maxVelocity) * 0.6 + 0.4;
  }

  private calculateHeatmapScore(heatmap: GazeMetrics['heatmap']): number {
    const totalIntensity = heatmap.points.reduce((sum, point) => sum + point.intensity, 0);
    const maxPossibleIntensity = heatmap.resolution * heatmap.resolution;
    
    return Math.min(1, totalIntensity / maxPossibleIntensity);
  }

  private normalizeSpeechRate(wordsPerMinute: number): number {
    // Normalize to 0-1 range, assuming 120-180 WPM is optimal
    if (wordsPerMinute < 120) return wordsPerMinute / 120;
    if (wordsPerMinute > 180) return 1 - ((wordsPerMinute - 180) / 120);
    return 1;
  }
} 