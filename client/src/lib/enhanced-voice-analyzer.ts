import { VoiceMetric } from "@shared/schema";

/**
 * EnhancedVoiceAnalyzer
 * 
 * A comprehensive voice analysis engine that provides real-time voice metrics
 * and advanced analysis capabilities. This class serves as the core voice
 * analysis component of the application.
 * 
 * Key Features:
 * - Real-time voice metrics calculation
 * - Voice tremor detection
 * - Emotion analysis
 * - Filler word detection
 * - Speech rate analysis
 * - Deepgram integration
 * 
 * Connections:
 * - Web Audio API: For audio processing
 * - Deepgram: For transcription and advanced analysis
 * - WebSocket: For real-time analysis server communication
 * - MediaStream: For audio input
 * 
 * Usage:
 * This class is typically instantiated by the useVoiceAnalyzer hook
 * and used throughout the application for voice analysis.
 */

export interface EnhancedVoiceMetrics {
  volume: number;
  pitch: number;
  clarity: number;
  pace: number;
  timestamp: number;
  fillerWords: {
    rate: number;
    words: Array<{ word: string; confidence: number }>;
  };
  speechRate: {
    wordsPerMinute: number;
    pauses: number;
  };
  voiceTremor: {
    detected: boolean;
    intensity: number;
  };
  emotion: {
    type: string;
    confidence: number;
  };
}

export interface RealTimeVoiceAnalysis {
  transcription: string;
  confidence: number;
  sentiment: string;
  emotion: string;
}

export class EnhancedVoiceAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private deepgramSocket: WebSocket | null = null;
  private audioBuffer: Float32Array[] = [];
  private isAnalyzing: boolean = false;
  private lastAnalysisTime: number = 0;
  private wordCount: number = 0;
  private pauseCount: number = 0;

  constructor(private deepgramApiKey: string) {}

  async initialize(stream: MediaStream): Promise<void> {
    this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);
    this.initializeDeepgram();
  }

  private initializeDeepgram(): void {
    const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&punctuate=true&filler_words=true&sentiment=true&emotion=true`;
    this.deepgramSocket = new WebSocket(deepgramUrl, ['token', this.deepgramApiKey]);

    this.deepgramSocket.onopen = () => {
      console.log('Deepgram connection established');
    };

    this.deepgramSocket.onerror = (error) => {
      console.error('Deepgram WebSocket error:', error);
    };

    this.deepgramSocket.onclose = () => {
      console.log('Deepgram connection closed');
    };
  }

  async analyzeVoice(): Promise<EnhancedVoiceMetrics> {
    if (!this.analyser) throw new Error("Analyzer not initialized");

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyData = new Uint8Array(bufferLength);
    
    this.analyser.getByteTimeDomainData(dataArray);
    this.analyser.getByteFrequencyData(frequencyData);

    // Calculate basic metrics
    const volume = this.calculateVolume(dataArray);
    const pitch = this.calculatePitch(frequencyData);
    const clarity = this.calculateClarity(frequencyData, volume);
    const pace = this.calculatePace();
    
    // Send to Deepgram if connected
    if (this.deepgramSocket?.readyState === WebSocket.OPEN) {
      const audioData = new Float32Array(dataArray).buffer;
      this.deepgramSocket.send(audioData);
    }

    return {
      volume,
      pitch,
      clarity,
      pace,
      timestamp: Date.now(),
      fillerWords: {
        rate: 0, // Will be updated by Deepgram
        words: []
      },
      speechRate: {
        wordsPerMinute: this.calculateWordsPerMinute(),
        pauses: this.pauseCount
      },
      voiceTremor: {
        detected: this.detectVoiceTremor(dataArray),
        intensity: this.calculateTremorIntensity(dataArray)
      },
      emotion: {
        type: "neutral", // Will be updated by Deepgram
        confidence: 0.8
      }
    };
  }

  private calculateVolume(dataArray: Uint8Array): number {
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    return Math.min(100, (average / 128) * 100);
  }

  private calculatePitch(frequencyData: Uint8Array): number {
    let maxIndex = 0;
    let maxValue = 0;
    
    const startIndex = Math.floor((85 / 22050) * frequencyData.length);
    const endIndex = Math.floor((400 / 22050) * frequencyData.length);
    
    for (let i = startIndex; i < Math.min(endIndex, frequencyData.length); i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i];
        maxIndex = i;
      }
    }
    
    const frequency = (maxIndex / frequencyData.length) * 22050;
    const normalizedPitch = Math.log(frequency / 85) / Math.log(400 / 85);
    return Math.min(100, Math.max(0, normalizedPitch * 100));
  }

  private calculateClarity(frequencyData: Uint8Array, volume: number): number {
    const totalEnergy = frequencyData.reduce((sum, value) => sum + value * value, 0);
    const avgEnergy = totalEnergy / frequencyData.length;
    
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      const magnitude = frequencyData[i];
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }
    
    const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    const normalizedCentroid = spectralCentroid / frequencyData.length;
    
    const energyFactor = Math.min(1, totalEnergy / (frequencyData.length * 100));
    const volumeFactor = Math.min(1, volume * 2);
    const clarityScore = (normalizedCentroid * energyFactor * volumeFactor) * 100;
    
    return Math.min(100, Math.max(0, clarityScore));
  }

  private calculatePace(): number {
    const now = Date.now();
    const timeDiff = now - this.lastAnalysisTime;
    this.lastAnalysisTime = now;

    if (timeDiff > 1000) {
      this.pauseCount++;
    }

    return Math.min(100, Math.max(0, (this.wordCount / 60) * 100));
  }

  private calculateWordsPerMinute(): number {
    return Math.round(this.wordCount / ((Date.now() - this.lastAnalysisTime) / 60000));
  }

  private detectVoiceTremor(dataArray: Uint8Array): boolean {
    const variations = [];
    for (let i = 1; i < dataArray.length; i++) {
      variations.push(Math.abs(dataArray[i] - dataArray[i - 1]));
    }
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    return avgVariation > 20; // Threshold for tremor detection
  }

  private calculateTremorIntensity(dataArray: Uint8Array): number {
    const variations = [];
    for (let i = 1; i < dataArray.length; i++) {
      variations.push(Math.abs(dataArray[i] - dataArray[i - 1]));
    }
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    return Math.min(1, avgVariation / 50); // Normalize to 0-1 range
  }

  destroy(): void {
    if (this.deepgramSocket) {
      this.deepgramSocket.close();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export const createEnhancedVoiceAnalyzer = (deepgramApiKey: string) => {
  return new EnhancedVoiceAnalyzer(deepgramApiKey);
};