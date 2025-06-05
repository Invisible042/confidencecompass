export interface EnhancedVoiceMetrics {
  // Basic metrics
  volume: number;
  pitch: number;
  clarity: number;
  pace: number;
  
  // Advanced speech analysis
  voiceStability: {
    jitter: number;
    shimmer: number;
    harmonicNoiseRatio: number;
  };
  
  // Fluency metrics
  fluency: {
    fillerWordCount: number;
    pauseFrequency: number;
    speechRate: number;
    articulation: number;
  };
  
  // Emotional indicators
  emotion: {
    valence: number; // positive/negative
    arousal: number; // energy level
    dominance: number; // confidence
    primaryEmotion: string;
  };
  
  // Communication quality
  communicationQuality: {
    eyeContactScore: number;
    gestureNaturalness: number;
    overallPresence: number;
    engagement: number;
  };
  
  timestamp: number;
}

export interface RealTimeVoiceAnalysis {
  currentMetrics: EnhancedVoiceMetrics;
  trends: {
    volumeTrend: number[];
    clarityTrend: number[];
    paceTrend: number[];
  };
  recommendations: string[];
  overallScore: number;
}

export class EnhancedVoiceAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private frequencyData: Uint8Array | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  
  // Analysis buffers
  private audioBuffer: Float32Array[] = [];
  private metricsHistory: EnhancedVoiceMetrics[] = [];
  private analysisWindow = 2048;
  private sampleRate = 44100;
  
  // Real-time analysis state
  private isAnalyzing = false;
  private deepgramConnection: WebSocket | null = null;
  private transcriptionBuffer = "";
  
  constructor(private deepgramApiKey?: string) {}

  async initialize(stream: MediaStream): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      
      // Configure analyzer for detailed analysis
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0.1;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
      
      // Set up data arrays
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      this.frequencyData = new Uint8Array(bufferLength);
      
      // Set up script processor for detailed audio analysis
      this.scriptProcessor = this.audioContext.createScriptProcessor(this.analysisWindow, 1, 1);
      this.scriptProcessor.onaudioprocess = (event) => {
        this.processAudioBuffer(event.inputBuffer.getChannelData(0));
      };
      
      this.microphone.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      // Initialize Deepgram connection if API key provided
      if (this.deepgramApiKey) {
        await this.initializeDeepgram();
      }
      
      this.isAnalyzing = true;
      console.log('Enhanced voice analyzer initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize enhanced voice analyzer:', error);
      throw error;
    }
  }

  private async initializeDeepgram(): Promise<void> {
    if (!this.deepgramApiKey) return;
    
    try {
      const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&punctuate=true&filler_words=true&sentiment=true&diarize=false`;
      
      this.deepgramConnection = new WebSocket(wsUrl, ['token', this.deepgramApiKey]);
      
      this.deepgramConnection.onopen = () => {
        console.log('Deepgram connection established for enhanced analysis');
      };
      
      this.deepgramConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel?.alternatives?.[0]?.transcript) {
            const transcript = data.channel.alternatives[0].transcript;
            if (transcript.trim()) {
              this.transcriptionBuffer += transcript + ' ';
              this.analyzeTranscript(transcript);
            }
          }
        } catch (error) {
          console.error('Error processing Deepgram response:', error);
        }
      };
      
      this.deepgramConnection.onerror = (error) => {
        console.error('Deepgram connection error:', error);
      };
      
    } catch (error) {
      console.error('Failed to initialize Deepgram:', error);
    }
  }

  private processAudioBuffer(buffer: Float32Array): void {
    if (!this.isAnalyzing) return;
    
    // Store audio buffer for analysis
    this.audioBuffer.push(new Float32Array(buffer));
    
    // Keep only recent buffers (last 5 seconds)
    const maxBuffers = Math.ceil((5 * this.sampleRate) / this.analysisWindow);
    if (this.audioBuffer.length > maxBuffers) {
      this.audioBuffer.shift();
    }
    
    // Send audio to Deepgram if connected
    if (this.deepgramConnection?.readyState === WebSocket.OPEN) {
      const audioData = this.convertToLinear16(buffer);
      this.deepgramConnection.send(audioData);
    }
  }

  private convertToLinear16(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, sample * 0x7FFF, true);
    }
    
    return buffer;
  }

  async analyzeCurrentVoice(): Promise<RealTimeVoiceAnalysis> {
    if (!this.analyser || !this.dataArray || !this.frequencyData) {
      throw new Error('Analyzer not initialized');
    }

    // Get current audio data
    this.analyser.getByteTimeDomainData(this.dataArray);
    this.analyser.getByteFrequencyData(this.frequencyData);

    // Calculate enhanced metrics
    const currentMetrics = await this.calculateEnhancedMetrics();
    
    // Store metrics history
    this.metricsHistory.push(currentMetrics);
    if (this.metricsHistory.length > 300) { // Keep last 5 minutes at 1Hz
      this.metricsHistory.shift();
    }

    // Calculate trends
    const trends = this.calculateTrends();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(currentMetrics, trends);
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(currentMetrics);

    return {
      currentMetrics,
      trends,
      recommendations,
      overallScore
    };
  }

  private async calculateEnhancedMetrics(): Promise<EnhancedVoiceMetrics> {
    const volume = this.calculateVolume();
    const pitch = this.calculatePitch();
    const clarity = this.calculateClarity();
    const pace = this.calculatePace();
    
    const voiceStability = this.analyzeVoiceStability();
    const fluency = this.analyzeFluency();
    const emotion = this.analyzeEmotion();
    const communicationQuality = this.analyzeCommunicationQuality();

    return {
      volume,
      pitch,
      clarity,
      pace,
      voiceStability,
      fluency,
      emotion,
      communicationQuality,
      timestamp: Date.now()
    };
  }

  private calculateVolume(): number {
    if (!this.dataArray) return 0;
    
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const sample = (this.dataArray[i] - 128) / 128;
      sum += sample * sample;
    }
    
    const rms = Math.sqrt(sum / this.dataArray.length);
    return Math.min(100, rms * 200);
  }

  private calculatePitch(): number {
    if (!this.frequencyData) return 0;
    
    // Use autocorrelation for more accurate pitch detection
    const fundamentalFreq = this.detectFundamentalFrequency();
    
    // Convert to perceptual pitch scale (0-100)
    const minPitch = 80; // Hz
    const maxPitch = 400; // Hz
    
    return Math.max(0, Math.min(100, ((fundamentalFreq - minPitch) / (maxPitch - minPitch)) * 100));
  }

  private detectFundamentalFrequency(): number {
    if (!this.audioBuffer.length) return 150; // Default
    
    const latestBuffer = this.audioBuffer[this.audioBuffer.length - 1];
    const autocorrelation = this.autocorrelate(latestBuffer);
    
    // Find the first peak in autocorrelation
    let bestPeriod = 0;
    let bestCorrelation = 0;
    
    const minPeriod = Math.floor(this.sampleRate / 400); // 400 Hz max
    const maxPeriod = Math.floor(this.sampleRate / 80);  // 80 Hz min
    
    for (let period = minPeriod; period < Math.min(maxPeriod, autocorrelation.length); period++) {
      if (autocorrelation[period] > bestCorrelation) {
        bestCorrelation = autocorrelation[period];
        bestPeriod = period;
      }
    }
    
    return bestPeriod > 0 ? this.sampleRate / bestPeriod : 150;
  }

  private autocorrelate(buffer: Float32Array): Float32Array {
    const length = buffer.length;
    const result = new Float32Array(length);
    
    for (let lag = 0; lag < length; lag++) {
      let sum = 0;
      for (let i = 0; i < length - lag; i++) {
        sum += buffer[i] * buffer[i + lag];
      }
      result[lag] = sum / (length - lag);
    }
    
    return result;
  }

  private calculateClarity(): number {
    if (!this.frequencyData) return 0;
    
    // Calculate spectral clarity measures
    const spectralCentroid = this.calculateSpectralCentroid();
    const spectralRolloff = this.calculateSpectralRolloff();
    const zeroCrossingRate = this.calculateZeroCrossingRate();
    
    // Combine measures for overall clarity score
    const clarityScore = (spectralCentroid * 0.4 + spectralRolloff * 0.3 + zeroCrossingRate * 0.3);
    return Math.max(0, Math.min(100, clarityScore));
  }

  private calculateSpectralCentroid(): number {
    if (!this.frequencyData) return 0;
    
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 1; i < this.frequencyData.length; i++) {
      const magnitude = this.frequencyData[i];
      const frequency = (i * this.sampleRate) / (2 * this.frequencyData.length);
      
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    const centroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    return Math.min(100, (centroid / 4000) * 100);
  }

  private calculateSpectralRolloff(): number {
    if (!this.frequencyData) return 0;
    
    let totalEnergy = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      totalEnergy += this.frequencyData[i] * this.frequencyData[i];
    }
    
    const threshold = totalEnergy * 0.85;
    let cumulativeEnergy = 0;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      cumulativeEnergy += this.frequencyData[i] * this.frequencyData[i];
      if (cumulativeEnergy >= threshold) {
        const frequency = (i * this.sampleRate) / (2 * this.frequencyData.length);
        return Math.min(100, (frequency / 8000) * 100);
      }
    }
    
    return 0;
  }

  private calculateZeroCrossingRate(): number {
    if (!this.dataArray) return 0;
    
    let crossings = 0;
    for (let i = 1; i < this.dataArray.length; i++) {
      const current = this.dataArray[i] - 128;
      const previous = this.dataArray[i - 1] - 128;
      
      if ((current > 0 && previous <= 0) || (current <= 0 && previous > 0)) {
        crossings++;
      }
    }
    
    const rate = crossings / this.dataArray.length;
    return Math.min(100, rate * 1000);
  }

  private calculatePace(): number {
    // Analyze speech rate from recent audio buffers
    if (this.audioBuffer.length < 10) return 50;
    
    const recentBuffers = this.audioBuffer.slice(-10);
    let energyChanges = 0;
    let totalEnergy = 0;
    
    for (const buffer of recentBuffers) {
      let bufferEnergy = 0;
      for (let i = 0; i < buffer.length; i++) {
        bufferEnergy += buffer[i] * buffer[i];
      }
      
      if (bufferEnergy > 0.01) { // Voice activity threshold
        totalEnergy += bufferEnergy;
        energyChanges++;
      }
    }
    
    // Estimate speaking rate
    const avgEnergyPerBuffer = totalEnergy / Math.max(1, energyChanges);
    const speechRate = (energyChanges / recentBuffers.length) * 100;
    
    return Math.max(0, Math.min(100, speechRate));
  }

  private analyzeVoiceStability(): { jitter: number; shimmer: number; harmonicNoiseRatio: number } {
    if (this.audioBuffer.length < 5) {
      return { jitter: 0, shimmer: 0, harmonicNoiseRatio: 15 };
    }
    
    // Calculate jitter (pitch variation)
    const pitchValues = this.audioBuffer.slice(-5).map(() => this.detectFundamentalFrequency());
    const avgPitch = pitchValues.reduce((sum, p) => sum + p, 0) / pitchValues.length;
    const pitchVariations = pitchValues.map(p => Math.abs(p - avgPitch));
    const jitter = (pitchVariations.reduce((sum, v) => sum + v, 0) / pitchVariations.length) / avgPitch * 100;
    
    // Calculate shimmer (amplitude variation)
    const amplitudeValues = this.audioBuffer.slice(-5).map(buffer => {
      return Math.sqrt(buffer.reduce((sum, sample) => sum + sample * sample, 0) / buffer.length);
    });
    const avgAmplitude = amplitudeValues.reduce((sum, a) => sum + a, 0) / amplitudeValues.length;
    const amplitudeVariations = amplitudeValues.map(a => Math.abs(a - avgAmplitude));
    const shimmer = (amplitudeVariations.reduce((sum, v) => sum + v, 0) / amplitudeVariations.length) / avgAmplitude * 100;
    
    // Estimate harmonic-to-noise ratio
    const harmonicNoiseRatio = this.estimateHNR();
    
    return {
      jitter: Math.min(10, jitter),
      shimmer: Math.min(10, shimmer),
      harmonicNoiseRatio
    };
  }

  private estimateHNR(): number {
    if (!this.frequencyData) return 15;
    
    // Simple HNR estimation based on spectral peaks
    const peaks = this.findSpectralPeaks();
    const harmonicEnergy = peaks.reduce((sum, peak) => sum + peak.magnitude, 0);
    const totalEnergy = this.frequencyData.reduce((sum, val) => sum + val, 0);
    
    const hnr = harmonicEnergy / Math.max(1, totalEnergy - harmonicEnergy);
    return Math.max(0, Math.min(30, 20 * Math.log10(hnr + 1)));
  }

  private findSpectralPeaks(): Array<{ frequency: number; magnitude: number }> {
    if (!this.frequencyData) return [];
    
    const peaks = [];
    const minPeakHeight = 50;
    
    for (let i = 2; i < this.frequencyData.length - 2; i++) {
      if (this.frequencyData[i] > minPeakHeight &&
          this.frequencyData[i] > this.frequencyData[i - 1] &&
          this.frequencyData[i] > this.frequencyData[i + 1] &&
          this.frequencyData[i] > this.frequencyData[i - 2] &&
          this.frequencyData[i] > this.frequencyData[i + 2]) {
        
        const frequency = (i * this.sampleRate) / (2 * this.frequencyData.length);
        peaks.push({ frequency, magnitude: this.frequencyData[i] });
      }
    }
    
    return peaks.slice(0, 10); // Top 10 peaks
  }

  private analyzeFluency(): { fillerWordCount: number; pauseFrequency: number; speechRate: number; articulation: number } {
    const fillerWords = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of', 'actually', 'basically'];
    const fillerWordCount = this.countFillerWords(fillerWords);
    
    // Analyze pauses and speech rate from audio energy
    const pauseFrequency = this.analyzePauses();
    const speechRate = this.calculateSpeechRate();
    const articulation = this.calculateArticulation();
    
    return {
      fillerWordCount,
      pauseFrequency,
      speechRate,
      articulation
    };
  }

  private countFillerWords(fillerWords: string[]): number {
    const words = this.transcriptionBuffer.toLowerCase().split(' ');
    return words.filter(word => fillerWords.includes(word.trim())).length;
  }

  private analyzePauses(): number {
    if (this.audioBuffer.length < 10) return 0;
    
    let pauseCount = 0;
    const energyThreshold = 0.01;
    
    for (const buffer of this.audioBuffer.slice(-20)) {
      let energy = 0;
      for (let i = 0; i < buffer.length; i++) {
        energy += buffer[i] * buffer[i];
      }
      energy /= buffer.length;
      
      if (energy < energyThreshold) {
        pauseCount++;
      }
    }
    
    return (pauseCount / Math.min(20, this.audioBuffer.length)) * 100;
  }

  private calculateSpeechRate(): number {
    const words = this.transcriptionBuffer.trim().split(' ').filter(w => w.length > 0);
    const timeWindow = Math.min(60, this.metricsHistory.length); // Last minute
    
    if (timeWindow === 0) return 0;
    
    const wordsPerMinute = (words.length / timeWindow) * 60;
    
    // Normalize to 0-100 scale (normal range: 120-180 WPM)
    return Math.max(0, Math.min(100, ((wordsPerMinute - 80) / (200 - 80)) * 100));
  }

  private calculateArticulation(): number {
    // Estimate articulation based on spectral clarity and consonant detection
    const spectralClarity = this.calculateSpectralCentroid();
    const highFreqEnergy = this.calculateHighFrequencyEnergy();
    
    return Math.max(0, Math.min(100, (spectralClarity * 0.6 + highFreqEnergy * 0.4)));
  }

  private calculateHighFrequencyEnergy(): number {
    if (!this.frequencyData) return 0;
    
    const highFreqStart = Math.floor(this.frequencyData.length * 0.6);
    let highFreqSum = 0;
    let totalSum = 0;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      totalSum += this.frequencyData[i];
      if (i >= highFreqStart) {
        highFreqSum += this.frequencyData[i];
      }
    }
    
    return totalSum > 0 ? (highFreqSum / totalSum) * 100 : 0;
  }

  private analyzeEmotion(): { valence: number; arousal: number; dominance: number; primaryEmotion: string } {
    // Basic emotion analysis based on audio features
    const spectralCentroid = this.calculateSpectralCentroid();
    const energy = this.calculateVolume();
    const pitch = this.calculatePitch();
    
    // Map audio features to emotional dimensions
    const arousal = Math.min(100, (energy * 0.6 + spectralCentroid * 0.4));
    const valence = Math.min(100, (pitch * 0.4 + (100 - this.analyzeVoiceStability().jitter * 10) * 0.6));
    const dominance = Math.min(100, (energy * 0.5 + this.calculateClarity() * 0.5));
    
    // Determine primary emotion
    let primaryEmotion = 'neutral';
    if (arousal > 60 && valence > 60) primaryEmotion = 'happy';
    else if (arousal > 60 && valence < 40) primaryEmotion = 'angry';
    else if (arousal < 40 && valence < 40) primaryEmotion = 'sad';
    else if (arousal > 70) primaryEmotion = 'excited';
    else if (dominance > 70) primaryEmotion = 'confident';
    
    return { valence, arousal, dominance, primaryEmotion };
  }

  private analyzeCommunicationQuality(): { eyeContactScore: number; gestureNaturalness: number; overallPresence: number; engagement: number } {
    // Placeholder for integration with face tracking data
    // In a real implementation, this would receive data from MediaPipe face tracking
    
    return {
      eyeContactScore: 75, // Would come from face tracking
      gestureNaturalness: 80, // Would come from pose estimation
      overallPresence: 78, // Combined score
      engagement: 82 // Activity and attention metrics
    };
  }

  private calculateTrends(): { volumeTrend: number[]; clarityTrend: number[]; paceTrend: number[] } {
    const recent = this.metricsHistory.slice(-30); // Last 30 measurements
    
    return {
      volumeTrend: recent.map(m => m.volume),
      clarityTrend: recent.map(m => m.clarity),
      paceTrend: recent.map(m => m.pace)
    };
  }

  private generateRecommendations(metrics: EnhancedVoiceMetrics, trends: any): string[] {
    const recommendations: string[] = [];
    
    // Volume recommendations
    if (metrics.volume < 30) {
      recommendations.push("Speak louder for better projection");
    } else if (metrics.volume > 80) {
      recommendations.push("Lower your voice volume slightly");
    }
    
    // Clarity recommendations
    if (metrics.clarity < 60) {
      recommendations.push("Focus on clearer articulation");
    }
    
    // Pace recommendations
    if (metrics.pace < 30) {
      recommendations.push("Increase your speaking pace");
    } else if (metrics.pace > 80) {
      recommendations.push("Slow down your speaking pace");
    }
    
    // Fluency recommendations
    if (metrics.fluency.fillerWordCount > 3) {
      recommendations.push("Reduce use of filler words");
    }
    
    if (metrics.fluency.pauseFrequency > 30) {
      recommendations.push("Reduce excessive pauses");
    }
    
    // Voice stability recommendations
    if (metrics.voiceStability.jitter > 2) {
      recommendations.push("Work on voice steadiness");
    }
    
    return recommendations.slice(0, 3); // Top 3 recommendations
  }

  private calculateOverallScore(metrics: EnhancedVoiceMetrics): number {
    const weights = {
      volume: 0.15,
      clarity: 0.25,
      pace: 0.20,
      stability: 0.15,
      fluency: 0.15,
      emotion: 0.10
    };
    
    const stabilityScore = 100 - (metrics.voiceStability.jitter * 5 + metrics.voiceStability.shimmer * 5);
    const fluencyScore = 100 - (metrics.fluency.fillerWordCount * 5 + metrics.fluency.pauseFrequency * 0.5);
    const emotionScore = (metrics.emotion.valence + metrics.emotion.arousal + metrics.emotion.dominance) / 3;
    
    const score = 
      metrics.volume * weights.volume +
      metrics.clarity * weights.clarity +
      metrics.pace * weights.pace +
      Math.max(0, stabilityScore) * weights.stability +
      Math.max(0, fluencyScore) * weights.fluency +
      emotionScore * weights.emotion;
    
    return Math.max(0, Math.min(100, score));
  }

  private analyzeTranscript(transcript: string): void {
    // Additional transcript analysis could be added here
    // For now, just update the buffer
    if (this.transcriptionBuffer.length > 1000) {
      this.transcriptionBuffer = this.transcriptionBuffer.slice(-500);
    }
  }

  destroy(): void {
    this.isAnalyzing = false;
    
    if (this.deepgramConnection) {
      this.deepgramConnection.close();
      this.deepgramConnection = null;
    }
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.audioBuffer = [];
    this.metricsHistory = [];
    this.transcriptionBuffer = "";
  }
}

export const createEnhancedVoiceAnalyzer = (deepgramApiKey?: string) => {
  return new EnhancedVoiceAnalyzer(deepgramApiKey);
};