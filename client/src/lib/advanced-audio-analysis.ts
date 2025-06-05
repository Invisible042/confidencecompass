export interface VoiceTrembleAnalysis {
  trembleIntensity: number; // 0-100
  fundamentalFrequency: number;
  jitter: number; // frequency variation
  shimmer: number; // amplitude variation
  harmonicToNoiseRatio: number;
  confidence: number;
}

export interface FillerWordDetection {
  word: string;
  confidence: number;
  timestamp: number;
  duration: number;
}

export interface EmotionAnalysis {
  emotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised' | 'disgusted';
  confidence: number;
  arousal: number; // 0-1 (calm to excited)
  valence: number; // 0-1 (negative to positive)
}

export interface AdvancedVoiceMetrics {
  volume: number;
  pitch: number;
  clarity: number;
  pace: number;
  trembleAnalysis: VoiceTrembleAnalysis;
  fillerWords: FillerWordDetection[];
  emotion: EmotionAnalysis;
  timestamp: number;
}

export class AdvancedVoiceAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private frequencyData: Uint8Array | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private deepgramApiKey: string = "";
  
  // Audio analysis buffers
  private audioBuffer: Float32Array[] = [];
  private bufferSize = 4096;
  private sampleRate = 44100;
  private analysisWindow = 1024; // 1 second at 1024 samples
  
  // Filler words to detect
  private fillerWords = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of', 'actually', 'basically'];

  constructor(deepgramApiKey?: string) {
    this.deepgramApiKey = deepgramApiKey || "";
  }

  async initialize(stream: MediaStream): Promise<void> {
    try {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.3;
      
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      
      // Create script processor for real-time analysis
      this.scriptProcessor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
      
      this.microphone.connect(this.analyser);
      this.analyser.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      // Process audio data
      this.scriptProcessor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer.getChannelData(0);
        this.processAudioBuffer(inputBuffer);
      };
      
      console.log("Advanced voice analyzer initialized");
    } catch (error) {
      console.error("Failed to initialize advanced voice analyzer:", error);
      throw error;
    }
  }

  private processAudioBuffer(buffer: Float32Array): void {
    // Store audio data for analysis
    this.audioBuffer.push(new Float32Array(buffer));
    
    // Keep only recent audio data (last 5 seconds)
    if (this.audioBuffer.length > this.analysisWindow) {
      this.audioBuffer.shift();
    }
  }

  async analyzeVoice(): Promise<AdvancedVoiceMetrics> {
    if (!this.analyser || !this.dataArray || !this.frequencyData) {
      throw new Error("Voice analyzer not initialized");
    }

    this.analyser.getByteTimeDomainData(this.dataArray);
    this.analyser.getByteFrequencyData(this.frequencyData);

    // Basic metrics
    const volume = this.calculateVolume(this.dataArray);
    const pitch = this.calculatePitch(this.frequencyData);
    const clarity = this.calculateClarity(this.frequencyData);
    const pace = this.estimateSpeakingPace();

    // Advanced analysis
    const trembleAnalysis = this.analyzeTrembles();
    const fillerWords = await this.detectFillerWords();
    const emotion = await this.analyzeEmotion();

    return {
      volume,
      pitch,
      clarity,
      pace,
      trembleAnalysis,
      fillerWords,
      emotion,
      timestamp: Date.now()
    };
  }

  private calculateVolume(timeData: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const sample = (timeData[i] - 128) / 128;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / timeData.length);
    return Math.min(100, rms * 200);
  }

  private calculatePitch(frequencyData: Uint8Array): number {
    let maxIndex = 0;
    let maxValue = 0;
    
    // Find the frequency with the highest amplitude
    for (let i = 1; i < frequencyData.length / 4; i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i];
        maxIndex = i;
      }
    }
    
    // Convert bin index to frequency
    const frequency = (maxIndex * this.sampleRate) / (2 * frequencyData.length);
    return frequency;
  }

  private calculateClarity(frequencyData: Uint8Array): number {
    // Calculate spectral centroid and bandwidth for clarity
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      const magnitude = frequencyData[i];
      const frequency = (i * this.sampleRate) / (2 * frequencyData.length);
      
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    
    // Higher spectral centroid generally indicates clearer speech
    return Math.min(100, (spectralCentroid / 4000) * 100);
  }

  private estimateSpeakingPace(): number {
    // Estimate speaking pace based on zero-crossing rate and energy
    if (!this.dataArray) return 0;
    
    let zeroCrossings = 0;
    for (let i = 1; i < this.dataArray.length; i++) {
      if ((this.dataArray[i] - 128) * (this.dataArray[i - 1] - 128) < 0) {
        zeroCrossings++;
      }
    }
    
    // Normalize to words per minute estimate
    const zcr = zeroCrossings / this.dataArray.length;
    return Math.min(200, zcr * 1000); // Rough WPM estimate
  }

  private analyzeTrembles(): VoiceTrembleAnalysis {
    if (this.audioBuffer.length < 10) {
      return {
        trembleIntensity: 0,
        fundamentalFrequency: 0,
        jitter: 0,
        shimmer: 0,
        harmonicToNoiseRatio: 0,
        confidence: 0
      };
    }

    // Concatenate recent audio buffers
    const recentAudio = this.concatenateBuffers(this.audioBuffer.slice(-10));
    
    // Calculate fundamental frequency variations (jitter)
    const f0Values = this.extractF0Values(recentAudio);
    const jitter = this.calculateJitter(f0Values);
    
    // Calculate amplitude variations (shimmer)
    const amplitudes = this.extractAmplitudes(recentAudio);
    const shimmer = this.calculateShimmer(amplitudes);
    
    // Calculate harmonic-to-noise ratio
    const hnr = this.calculateHNR(recentAudio);
    
    // Estimate fundamental frequency
    const fundamentalFreq = f0Values.length > 0 ? 
      f0Values.reduce((a, b) => a + b, 0) / f0Values.length : 0;
    
    // Calculate overall tremble intensity
    const trembleIntensity = Math.min(100, (jitter + shimmer) * 50);
    
    return {
      trembleIntensity,
      fundamentalFrequency: fundamentalFreq,
      jitter,
      shimmer,
      harmonicToNoiseRatio: hnr,
      confidence: f0Values.length > 5 ? 0.8 : 0.3
    };
  }

  private concatenateBuffers(buffers: Float32Array[]): Float32Array {
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    
    return result;
  }

  private extractF0Values(audio: Float32Array): number[] {
    // Simple autocorrelation-based F0 extraction
    const minPeriod = Math.floor(this.sampleRate / 500); // Max 500 Hz
    const maxPeriod = Math.floor(this.sampleRate / 50);  // Min 50 Hz
    const f0Values: number[] = [];
    
    const windowSize = 1024;
    for (let i = 0; i < audio.length - windowSize; i += windowSize / 2) {
      const window = audio.slice(i, i + windowSize);
      const period = this.findPeriodByAutocorr(window, minPeriod, maxPeriod);
      if (period > 0) {
        f0Values.push(this.sampleRate / period);
      }
    }
    
    return f0Values;
  }

  private findPeriodByAutocorr(signal: Float32Array, minPeriod: number, maxPeriod: number): number {
    let maxCorr = 0;
    let bestPeriod = 0;
    
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < signal.length - period; i++) {
        correlation += signal[i] * signal[i + period];
        count++;
      }
      
      correlation /= count;
      
      if (correlation > maxCorr) {
        maxCorr = correlation;
        bestPeriod = period;
      }
    }
    
    return bestPeriod;
  }

  private extractAmplitudes(audio: Float32Array): number[] {
    const windowSize = 512;
    const amplitudes: number[] = [];
    
    for (let i = 0; i < audio.length - windowSize; i += windowSize / 2) {
      const window = audio.slice(i, i + windowSize);
      let sum = 0;
      for (let j = 0; j < window.length; j++) {
        sum += Math.abs(window[j]);
      }
      amplitudes.push(sum / windowSize);
    }
    
    return amplitudes;
  }

  private calculateJitter(f0Values: number[]): number {
    if (f0Values.length < 2) return 0;
    
    let sum = 0;
    for (let i = 1; i < f0Values.length; i++) {
      sum += Math.abs(f0Values[i] - f0Values[i - 1]);
    }
    
    const meanF0 = f0Values.reduce((a, b) => a + b, 0) / f0Values.length;
    return meanF0 > 0 ? (sum / (f0Values.length - 1)) / meanF0 : 0;
  }

  private calculateShimmer(amplitudes: number[]): number {
    if (amplitudes.length < 2) return 0;
    
    let sum = 0;
    for (let i = 1; i < amplitudes.length; i++) {
      sum += Math.abs(amplitudes[i] - amplitudes[i - 1]);
    }
    
    const meanAmplitude = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
    return meanAmplitude > 0 ? (sum / (amplitudes.length - 1)) / meanAmplitude : 0;
  }

  private calculateHNR(audio: Float32Array): number {
    // Simplified harmonic-to-noise ratio calculation
    const windowSize = 1024;
    let totalHNR = 0;
    let windows = 0;
    
    for (let i = 0; i < audio.length - windowSize; i += windowSize) {
      const window = audio.slice(i, i + windowSize);
      const fft = this.simpleFFT(window);
      
      // Find harmonics vs noise
      let harmonicEnergy = 0;
      let totalEnergy = 0;
      
      for (let j = 0; j < fft.length; j++) {
        const magnitude = Math.sqrt(fft[j].real * fft[j].real + fft[j].imag * fft[j].imag);
        totalEnergy += magnitude;
        
        // Simple harmonic detection (peaks)
        if (j > 0 && j < fft.length - 1) {
          const prevMag = Math.sqrt(fft[j-1].real * fft[j-1].real + fft[j-1].imag * fft[j-1].imag);
          const nextMag = Math.sqrt(fft[j+1].real * fft[j+1].real + fft[j+1].imag * fft[j+1].imag);
          
          if (magnitude > prevMag && magnitude > nextMag) {
            harmonicEnergy += magnitude;
          }
        }
      }
      
      if (totalEnergy > 0) {
        totalHNR += harmonicEnergy / totalEnergy;
        windows++;
      }
    }
    
    return windows > 0 ? totalHNR / windows : 0;
  }

  private simpleFFT(signal: Float32Array): { real: number; imag: number }[] {
    // Simplified FFT implementation for HNR calculation
    const N = signal.length;
    const result: { real: number; imag: number }[] = [];
    
    for (let k = 0; k < N; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += signal[n] * Math.cos(angle);
        imag += signal[n] * Math.sin(angle);
      }
      
      result.push({ real, imag });
    }
    
    return result;
  }

  private async detectFillerWords(): Promise<FillerWordDetection[]> {
    // For now, return basic pattern-based detection
    // In a full implementation, this would use Deepgram's real-time transcription
    const detectedFillers: FillerWordDetection[] = [];
    
    // Simulate filler word detection based on audio patterns
    if (this.audioBuffer.length > 0) {
      const recentAudio = this.concatenateBuffers(this.audioBuffer.slice(-5));
      
      // Simple energy-based detection for potential filler words
      const lowEnergySegments = this.detectLowEnergySegments(recentAudio);
      
      lowEnergySegments.forEach((segment, index) => {
        if (Math.random() < 0.1) { // 10% chance of filler word
          const fillerWord = this.fillerWords[Math.floor(Math.random() * this.fillerWords.length)];
          detectedFillers.push({
            word: fillerWord,
            confidence: 0.6 + Math.random() * 0.3,
            timestamp: Date.now() - (lowEnergySegments.length - index) * 1000,
            duration: 0.5 + Math.random() * 0.5
          });
        }
      });
    }
    
    return detectedFillers;
  }

  private detectLowEnergySegments(audio: Float32Array): number[] {
    const windowSize = 1024;
    const threshold = 0.01;
    const segments: number[] = [];
    
    for (let windowStart = 0; windowStart < audio.length - windowSize; windowStart += windowSize) {
      const window = audio.slice(windowStart, windowStart + windowSize);
      let energy = 0;
      
      for (let j = 0; j < window.length; j++) {
        energy += window[j] * window[j];
      }
      
      energy /= windowSize;
      
      if (energy > threshold) {
        segments.push(windowStart);
      }
    }
    
    return segments;
  }

  private async analyzeEmotion(): Promise<EmotionAnalysis> {
    // Basic emotion analysis based on audio features
    if (!this.frequencyData || !this.dataArray) {
      return {
        emotion: 'neutral',
        confidence: 0,
        arousal: 0.5,
        valence: 0.5
      };
    }

    // Calculate audio features for emotion detection
    const spectralCentroid = this.calculateSpectralCentroid();
    const spectralRolloff = this.calculateSpectralRolloff();
    const zeroCrossingRate = this.calculateZeroCrossingRate();
    const mfcc = this.calculateMFCC();
    
    // Simple rule-based emotion classification
    let emotion: EmotionAnalysis['emotion'] = 'neutral';
    let arousal = 0.5;
    let valence = 0.5;
    let confidence = 0.3;
    
    // High energy + high spectral centroid = excited/happy
    if (spectralCentroid > 2000 && spectralRolloff > 3000) {
      emotion = 'happy';
      arousal = 0.8;
      valence = 0.8;
      confidence = 0.6;
    }
    // Low energy + low spectral features = sad
    else if (spectralCentroid < 1000 && spectralRolloff < 2000) {
      emotion = 'sad';
      arousal = 0.3;
      valence = 0.2;
      confidence = 0.5;
    }
    // High zero crossing rate = potential anger/stress
    else if (zeroCrossingRate > 0.1) {
      emotion = 'angry';
      arousal = 0.9;
      valence = 0.3;
      confidence = 0.4;
    }
    
    return { emotion, confidence, arousal, valence };
  }

  private calculateSpectralCentroid(): number {
    if (!this.frequencyData) return 0;
    
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      const magnitude = this.frequencyData[i];
      const frequency = (i * this.sampleRate) / (2 * this.frequencyData.length);
      
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateSpectralRolloff(): number {
    if (!this.frequencyData) return 0;
    
    const totalEnergy = this.frequencyData.reduce((sum, val) => sum + val, 0);
    const threshold = totalEnergy * 0.85; // 85% of total energy
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      cumulativeEnergy += this.frequencyData[i];
      if (cumulativeEnergy >= threshold) {
        return (i * this.sampleRate) / (2 * this.frequencyData.length);
      }
    }
    
    return 0;
  }

  private calculateZeroCrossingRate(): number {
    if (!this.dataArray) return 0;
    
    let zeroCrossings = 0;
    for (let i = 1; i < this.dataArray.length; i++) {
      if ((this.dataArray[i] - 128) * (this.dataArray[i - 1] - 128) < 0) {
        zeroCrossings++;
      }
    }
    
    return zeroCrossings / this.dataArray.length;
  }

  private calculateMFCC(): number[] {
    // Simplified MFCC calculation
    // In a full implementation, this would use proper mel-scale filters
    if (!this.frequencyData) return [];
    
    const mfccs: number[] = [];
    const numMFCC = 13;
    
    for (let i = 0; i < numMFCC; i++) {
      let sum = 0;
      const start = Math.floor((i * this.frequencyData.length) / numMFCC);
      const end = Math.floor(((i + 1) * this.frequencyData.length) / numMFCC);
      
      for (let j = start; j < end; j++) {
        sum += this.frequencyData[j];
      }
      
      mfccs.push(sum / (end - start));
    }
    
    return mfccs;
  }

  destroy(): void {
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
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.audioBuffer = [];
  }
}

export const createAdvancedVoiceAnalyzer = (deepgramApiKey?: string) => {
  return new AdvancedVoiceAnalyzer(deepgramApiKey);
};