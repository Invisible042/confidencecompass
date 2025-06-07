/**
 * VoiceAnalysisService
 * 
 * This service provides comprehensive voice analysis capabilities for the conversation practice system.
 * It combines real-time audio analysis with transcription and advanced metrics processing.
 * 
 * Key Features:
 * - Real-time voice analysis using EnhancedVoiceAnalyzer
 * - Integration with Deepgram for transcription
 * - Advanced metrics including:
 *   - Voice tremor detection
 *   - Speech rate analysis
 *   - Filler word detection
 *   - Emotional state analysis
 * 
 * Connections:
 * - DeepgramService: For speech-to-text transcription
 * - EnhancedVoiceAnalyzer: For real-time voice analysis
 * - MediaStream: For audio input processing
 * 
 * Usage:
 * This service is typically instantiated by the conversation practice system
 * and used to analyze user's voice during practice sessions.
 */

import { DeepgramService, DeepgramTranscription } from './deepgram-service';
import { EnhancedVoiceAnalyzer, EnhancedVoiceMetrics } from '../client/src/lib/enhanced-voice-analyzer';

export interface VoiceMetrics extends EnhancedVoiceMetrics {
  // Additional server-specific metrics can be added here
}

export class VoiceAnalysisService {
  private readonly TREMOR_THRESHOLD = 0.3;
  private readonly MIN_TREMOR_DURATION = 500; // ms
  private readonly SPEECH_RATE_WINDOW = 60000; // 1 minute
  private voiceAnalyzer: EnhancedVoiceAnalyzer | null = null;
  
  constructor(
    private deepgramService: DeepgramService,
    private config: {
      language: string;
      enableTremorDetection: boolean;
      enableSpeechRateAnalysis: boolean;
      deepgramApiKey: string;
    }
  ) {
    if (config.enableTremorDetection) {
      this.voiceAnalyzer = new EnhancedVoiceAnalyzer(config.deepgramApiKey);
    }
  }

  public async startVoiceAnalysis(stream: MediaStream): Promise<void> {
    if (this.config.enableTremorDetection && this.voiceAnalyzer) {
      await this.voiceAnalyzer.initialize(stream);
    }
  }

  public stopVoiceAnalysis(): void {
    if (this.voiceAnalyzer) {
      this.voiceAnalyzer.destroy();
    }
  }

  public async analyzeVoice(audioBuffer: ArrayBuffer): Promise<VoiceMetrics> {
    const transcription = await this.deepgramService.transcribeAudio(audioBuffer);
    const enhancedMetrics = this.voiceAnalyzer ? 
      await this.voiceAnalyzer.analyzeVoice() : 
      {
        volume: 0,
        pitch: 0,
        clarity: 0,
        pace: 0,
        timestamp: Date.now(),
        fillerWords: { rate: 0, words: [] },
        speechRate: { wordsPerMinute: 0, pauses: 0 },
        voiceTremor: { detected: false, intensity: 0 },
        emotion: { type: "neutral", confidence: 0 }
      };

    return {
      ...enhancedMetrics,
      // Additional server-specific metrics can be added here
    };
  }

  private async processTranscription(transcription: DeepgramTranscription): Promise<EnhancedVoiceMetrics> {
    const fillerWords = this.analyzeFillerWords(transcription);
    const speechRate = this.analyzeSpeechRate(transcription);
    const voiceTremor = await this.detectVoiceTremor(transcription);
    const emotion = this.analyzeEmotion(transcription);

    return {
      volume: 0, // These will be updated by the voice analyzer
      pitch: 0,
      clarity: 0,
      pace: 0,
      timestamp: Date.now(),
      fillerWords: {
        rate: fillerWords.rate,
        words: fillerWords.words.map(w => ({ word: w.word, confidence: w.confidence }))
      },
      speechRate: {
        wordsPerMinute: speechRate.wordsPerMinute,
        pauses: speechRate.pauses
      },
      voiceTremor,
      emotion
    };
  }

  private analyzeFillerWords(transcription: DeepgramTranscription) {
    const fillerWords = transcription.fillerWords || [];
    const duration = transcription.metadata.duration;
    
    return {
      count: fillerWords.length,
      rate: (fillerWords.length / duration) * 60, // per minute
      words: fillerWords.map(word => ({
        word: word.word,
        timestamp: word.start,
        confidence: word.confidence
      }))
    };
  }

  private analyzeSpeechRate(transcription: DeepgramTranscription) {
    const words = transcription.words;
    const duration = transcription.metadata.duration;
    
    // Calculate words per minute
    const wordsPerMinute = (words.length / duration) * 60;
    
    // Calculate syllables per minute
    const totalSyllables = words.reduce((sum, word) => 
      sum + this.countSyllables(word.word), 0);
    const syllablesPerMinute = (totalSyllables / duration) * 60;
    
    // Detect pauses
    const pauses = this.detectPauses(words);
    
    return {
      wordsPerMinute,
      syllablesPerMinute,
      pauses
    };
  }

  private async detectVoiceTremor(transcription: DeepgramTranscription): Promise<EnhancedVoiceMetrics['voiceTremor']> {
    if (!this.config.enableTremorDetection || !this.voiceAnalyzer) {
      return {
        detected: false,
        intensity: 0
      };
    }

    try {
      const metrics = await this.voiceAnalyzer.analyzeVoice();
      return metrics.voiceTremor;
    } catch (error) {
      console.error('Error analyzing voice tremor:', error);
      return {
        detected: false,
        intensity: 0
      };
    }
  }

  private analyzeEmotion(transcription: DeepgramTranscription) {
    const emotions = transcription.emotions || [];
    const timeline = emotions.map(segment => ({
      emotion: segment.emotion,
      start: segment.start,
      end: segment.end,
      confidence: segment.confidence
    }));

    // Find dominant emotion
    const emotionCounts = emotions.reduce((counts, segment) => {
      counts[segment.emotion] = (counts[segment.emotion] || 0) + 
        (segment.end - segment.start);
      return counts;
    }, {} as Record<string, number>);

    const dominantEmotion = Object.entries(emotionCounts)
      .reduce((max, [emotion, duration]) => 
        duration > (max.duration || 0) ? { emotion, duration } : max,
        { emotion: 'neutral', duration: 0 });

    return {
      type: dominantEmotion.emotion,
      confidence: emotions.reduce((sum, e) => sum + e.confidence, 0) / emotions.length
    };
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace('^y', '');
    
    const syllables = word.match(/[aeiouy]{1,2}/g);
    return syllables ? syllables.length : 1;
  }

  private detectPauses(words: DeepgramTranscription['words']) {
    const PAUSE_THRESHOLD = 500; // ms
    let pauseCount = 0;
    
    for (let i = 1; i < words.length; i++) {
      const pause = words[i].start - words[i - 1].end;
      if (pause >= PAUSE_THRESHOLD) {
        pauseCount++;
      }
    }
    
    return pauseCount;
  }

  private calculatePitchVariation(current: any, previous: any): number {
    // This is a simplified version - in reality, you'd need actual pitch data
    // from the audio analysis
    const timeDiff = current.start - previous.end;
    if (timeDiff > 100) return 0; // Ignore large gaps
    
    // Simulate pitch variation based on word confidence
    return Math.abs(current.confidence - previous.confidence);
  }
} 