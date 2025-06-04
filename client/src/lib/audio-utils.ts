// Audio analysis utilities for voice coaching

export interface AudioAnalysisConfig {
  sampleRate: number;
  fftSize: number;
  smoothingTimeConstant: number;
}

export interface VoiceAnalysisResult {
  volume: number;          // 0-100
  pitch: number;          // Fundamental frequency in Hz
  clarity: number;        // 0-100, based on spectral analysis
  pace: number;           // Words per minute (estimated)
  voiceActivity: boolean; // Whether speech is detected
}

export class VoiceAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private frequencyData: Uint8Array | null = null;

  constructor(private config: AudioAnalysisConfig) {}

  async initialize(stream: MediaStream): Promise<void> {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: this.config.sampleRate
    });

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;

    this.microphone = this.audioContext.createMediaStreamSource(stream);
    this.microphone.connect(this.analyser);

    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
    this.frequencyData = new Uint8Array(bufferLength);
  }

  analyze(): VoiceAnalysisResult {
    if (!this.analyser || !this.dataArray || !this.frequencyData) {
      throw new Error("Analyzer not initialized");
    }

    // Get time domain data for volume and voice activity
    this.analyser.getByteTimeDomainData(this.dataArray);
    
    // Get frequency domain data for pitch and clarity
    this.analyser.getByteFrequencyData(this.frequencyData);

    const volume = this.calculateVolume(this.dataArray);
    const pitch = this.calculatePitch(this.frequencyData);
    const clarity = this.calculateClarity(this.frequencyData);
    const voiceActivity = this.detectVoiceActivity(this.dataArray);
    const pace = this.estimateSpeakingPace(); // Simplified implementation

    return {
      volume,
      pitch,
      clarity,
      pace,
      voiceActivity
    };
  }

  private calculateVolume(timeData: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const sample = (timeData[i] - 128) / 128; // Convert to -1 to 1 range
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / timeData.length);
    return Math.min(100, rms * 100 * 3); // Scale and clamp to 0-100
  }

  private calculatePitch(frequencyData: Uint8Array): number {
    // Simplified pitch detection - find the dominant frequency
    let maxIndex = 0;
    let maxValue = 0;

    // Focus on typical human voice range (80Hz - 1000Hz)
    const minIndex = Math.floor(80 * frequencyData.length / (this.config.sampleRate / 2));
    const maxIndex = Math.floor(1000 * frequencyData.length / (this.config.sampleRate / 2));

    for (let i = minIndex; i < maxIndex && i < frequencyData.length; i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i];
        maxIndex = i;
      }
    }

    // Convert index back to frequency
    const frequency = (maxIndex * this.config.sampleRate / 2) / frequencyData.length;
    return frequency;
  }

  private calculateClarity(frequencyData: Uint8Array): number {
    // Simplified clarity calculation based on spectral centroid and spread
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < frequencyData.length; i++) {
      const magnitude = frequencyData[i];
      const frequency = (i * this.config.sampleRate / 2) / frequencyData.length;
      
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }

    if (magnitudeSum === 0) return 0;

    const spectralCentroid = weightedSum / magnitudeSum;
    
    // Normalize to 0-100 scale (higher centroid = clearer speech)
    return Math.min(100, (spectralCentroid / 4000) * 100);
  }

  private detectVoiceActivity(timeData: Uint8Array): boolean {
    const volume = this.calculateVolume(timeData);
    return volume > 5; // Simple threshold-based VAD
  }

  private estimateSpeakingPace(): number {
    // Simplified pace estimation - would need more sophisticated analysis
    // This is a placeholder that returns a value between 60-180 WPM
    return Math.random() * 120 + 60;
  }

  destroy(): void {
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.dataArray = null;
    this.frequencyData = null;
  }
}

export const createVoiceAnalyzer = (config: Partial<AudioAnalysisConfig> = {}) => {
  const defaultConfig: AudioAnalysisConfig = {
    sampleRate: 44100,
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    ...config
  };
  
  return new VoiceAnalyzer(defaultConfig);
};
