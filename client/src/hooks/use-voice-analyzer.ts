import { useState, useCallback, useRef, useEffect } from "react";
import { VoiceMetric } from "@shared/schema";
import { AdvancedVoiceAnalyzer, AdvancedVoiceMetrics } from "../lib/advanced-audio-analysis";
import { EnhancedVoiceAnalyzer, EnhancedVoiceMetrics, RealTimeVoiceAnalysis } from "../lib/enhanced-voice-analyzer";

// Enhanced voice analyzer interface
interface VoiceAnalyzerOptions {
  enableDeepgram?: boolean;
  livekitAudioTrack?: any; // LiveKit audio track
  deepgramApiKey?: string;
}

export function useVoiceAnalyzer(options: VoiceAnalyzerOptions = {}) {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetric[]>([]);
  const [advancedMetrics, setAdvancedMetrics] = useState<AdvancedVoiceMetrics | null>(null);
  const [enhancedMetrics, setEnhancedMetrics] = useState<EnhancedVoiceMetrics | null>(null);
  const [realTimeAnalysis, setRealTimeAnalysis] = useState<RealTimeVoiceAnalysis | null>(null);
  const [deepgramTranscription, setDeepgramTranscription] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const advancedAnalyzerRef = useRef<AdvancedVoiceAnalyzer | null>(null);
  const enhancedAnalyzerRef = useRef<EnhancedVoiceAnalyzer | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize enhanced voice analyzer
  useEffect(() => {
    if (options.enableDeepgram && options.deepgramApiKey) {
      advancedAnalyzerRef.current = new AdvancedVoiceAnalyzer(options.deepgramApiKey);
      enhancedAnalyzerRef.current = new EnhancedVoiceAnalyzer(options.deepgramApiKey);
    }
    
    return () => {
      if (advancedAnalyzerRef.current) {
        advancedAnalyzerRef.current.destroy();
      }
      if (enhancedAnalyzerRef.current) {
        enhancedAnalyzerRef.current.destroy();
      }
      if (deepgramSocketRef.current) {
        deepgramSocketRef.current.close();
      }
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [options.enableDeepgram, options.deepgramApiKey]);

  // Handle LiveKit audio track changes
  useEffect(() => {
    if (options.livekitAudioTrack && isRecording) {
      connectToLivekitAudio();
    }
  }, [options.livekitAudioTrack, isRecording]);

  const connectToLivekitAudio = useCallback(async () => {
    if (!options.livekitAudioTrack || !audioContextRef.current) return;

    try {
      // Connect to LiveKit audio track
      const mediaStream = new MediaStream([options.livekitAudioTrack.mediaStreamTrack]);
      const source = audioContextRef.current.createMediaStreamSource(mediaStream);
      
      if (analyserRef.current) {
        source.connect(analyserRef.current);
      }

      // Initialize advanced analyzer with LiveKit stream
      if (advancedAnalyzerRef.current) {
        await advancedAnalyzerRef.current.initialize(mediaStream);
      }
    } catch (error) {
      console.error('Failed to connect to LiveKit audio:', error);
    }
  }, [options.livekitAudioTrack]);

  const initializeDeepgramConnection = useCallback(() => {
    if (!options.enableDeepgram || !options.deepgramApiKey) return;

    const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&punctuate=true&filler_words=true&sentiment=true&emotion=true`;
    
    deepgramSocketRef.current = new WebSocket(deepgramUrl, ['token', options.deepgramApiKey]);

    deepgramSocketRef.current.onopen = () => {
      console.log('Deepgram connection established');
    };

    deepgramSocketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
        const transcript = data.channel.alternatives[0].transcript;
        if (transcript && transcript.trim()) {
          setDeepgramTranscription(prev => {
            if (data.is_final) {
              return prev + transcript + ' ';
            }
            return transcript;
          });
        }
      }
    };

    deepgramSocketRef.current.onerror = (error) => {
      console.error('Deepgram WebSocket error:', error);
    };

    deepgramSocketRef.current.onclose = () => {
      console.log('Deepgram connection closed');
    };
  }, [options.enableDeepgram, options.deepgramApiKey]);

  const analyzeAudio = useCallback(async () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyData = new Uint8Array(bufferLength);
    
    analyser.getByteTimeDomainData(dataArray);
    analyser.getByteFrequencyData(frequencyData);
    
    // Calculate basic volume level
    const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
    const volume = Math.min(100, (average / 128) * 100);
    setAudioLevel(volume);

    // Convert to Float32Array for advanced analysis
    const floatData = new Float32Array(bufferLength);
    for (let i = 0; i < bufferLength; i++) {
      floatData[i] = (dataArray[i] - 128) / 128;
    }

    // Store audio buffer for analysis
    audioBufferRef.current.push(floatData);
    if (audioBufferRef.current.length > 100) { // Keep last 100 frames
      audioBufferRef.current.shift();
    }

    // Perform advanced voice analysis
    if (advancedAnalyzerRef.current && audioBufferRef.current.length >= 10) {
      try {
        setIsAnalyzing(true);
        const advanced = await advancedAnalyzerRef.current.analyzeVoice();
        setAdvancedMetrics(advanced);

        // Convert advanced metrics to basic voice metric
        const basicMetric: VoiceMetric = {
          volume: advanced.volume,
          pitch: advanced.pitch,
          clarity: advanced.clarity,
          pace: advanced.pace,
          timestamp: advanced.timestamp
        };

        setVoiceMetrics(prev => [...prev.slice(-100), basicMetric]);
        setIsAnalyzing(false);
      } catch (error) {
        console.error('Advanced analysis error:', error);
        setIsAnalyzing(false);
      }
    } else {
      // Fallback to basic analysis
      const basicMetric: VoiceMetric = {
        volume: volume,
        pitch: calculateBasicPitch(frequencyData),
        clarity: calculateBasicClarity(frequencyData, volume),
        pace: calculateBasicPace(),
        timestamp: Date.now()
      };

      setVoiceMetrics(prev => [...prev.slice(-100), basicMetric]);
    }

    // Send audio to Deepgram for transcription
    if (deepgramSocketRef.current && deepgramSocketRef.current.readyState === WebSocket.OPEN) {
      const audioData = floatData.buffer.slice(0);
      deepgramSocketRef.current.send(audioData);
    }

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  const calculateBasicPitch = (frequencyData: Uint8Array): number => {
    // Enhanced pitch detection using autocorrelation and peak finding
    let maxIndex = 0;
    let maxValue = 0;
    
    // Focus on human voice frequency range (85-255 Hz fundamental)
    const startIndex = Math.floor((85 / 22050) * frequencyData.length);
    const endIndex = Math.floor((400 / 22050) * frequencyData.length);
    
    for (let i = startIndex; i < Math.min(endIndex, frequencyData.length); i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i];
        maxIndex = i;
      }
    }
    
    // Convert to pitch score with better mapping
    const frequency = (maxIndex / frequencyData.length) * 22050;
    const normalizedPitch = Math.log(frequency / 85) / Math.log(400 / 85);
    return Math.min(100, Math.max(0, normalizedPitch * 100));
  };

  const calculateBasicClarity = (frequencyData: Uint8Array, volume: number): number => {
    // Enhanced clarity calculation using spectral centroid and SNR
    const totalEnergy = frequencyData.reduce((sum, value) => sum + value * value, 0);
    const avgEnergy = totalEnergy / frequencyData.length;
    
    // Calculate spectral centroid for clarity
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      const magnitude = frequencyData[i];
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }
    
    const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    const normalizedCentroid = spectralCentroid / frequencyData.length;
    
    // Combine multiple factors for better clarity score
    const energyFactor = Math.min(1, totalEnergy / (frequencyData.length * 100));
    const volumeFactor = Math.min(1, volume * 2);
    const clarityScore = (normalizedCentroid * energyFactor * volumeFactor) * 100;
    
    return Math.min(100, Math.max(0, clarityScore));
  };

  const calculateBasicPace = (): number => {
    // Estimate speaking pace based on audio level changes
    if (voiceMetrics.length < 10) return 50;
    
    const recentMetrics = voiceMetrics.slice(-10);
    let changes = 0;
    
    for (let i = 1; i < recentMetrics.length; i++) {
      if (Math.abs(recentMetrics[i].volume - recentMetrics[i-1].volume) > 10) {
        changes++;
      }
    }
    
    // Normalize to 0-100 scale
    return Math.min(100, (changes / 9) * 100);
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1
        } 
      });
      
      streamRef.current = stream;
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Increased for better frequency resolution
      analyser.smoothingTimeConstant = 0.3; // Reduced for more responsive analysis
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Initialize enhanced analyzer if enabled
      if (options.enableDeepgram && enhancedAnalyzerRef.current) {
        await enhancedAnalyzerRef.current.initialize(stream);
        
        // Start real-time enhanced analysis
        analysisIntervalRef.current = setInterval(async () => {
          if (enhancedAnalyzerRef.current) {
            try {
              const analysis = await enhancedAnalyzerRef.current.analyzeCurrentVoice();
              setRealTimeAnalysis(analysis);
              setEnhancedMetrics(analysis.currentMetrics);
              
              // Update transcription from enhanced analyzer
              const transcript = (enhancedAnalyzerRef.current as any).transcriptionBuffer || "";
              setDeepgramTranscription(transcript);
            } catch (error) {
              console.warn('Enhanced analysis failed:', error);
            }
          }
        }, 1000); // Analyze every second
      }

      // Initialize advanced analyzer if enabled
      if (options.enableDeepgram && advancedAnalyzerRef.current) {
        await advancedAnalyzerRef.current.initialize(stream);
      }

      // Initialize Deepgram connection
      if (options.enableDeepgram) {
        initializeDeepgramConnection();
      }
      
      setIsRecording(true);
      analyzeAudio();
    } catch (error) {
      console.error("Error starting audio recording:", error);
      throw error;
    }
  }, [analyzeAudio, options.enableDeepgram, initializeDeepgramConnection]);

  const stopRecording = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (deepgramSocketRef.current) {
      deepgramSocketRef.current.close();
      deepgramSocketRef.current = null;
    }

    if (advancedAnalyzerRef.current) {
      advancedAnalyzerRef.current.destroy();
    }
    
    analyserRef.current = null;
    setIsRecording(false);
    setAudioLevel(0);
    setIsAnalyzing(false);
    audioBufferRef.current = [];
  }, []);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsRecording(audioTrack.enabled);
      }
    }
  }, []);

  const resetAnalysis = useCallback(() => {
    setVoiceMetrics([]);
    setAdvancedMetrics(null);
    setDeepgramTranscription("");
    audioBufferRef.current = [];
  }, []);

  const getVoiceAnalysisSummary = useCallback(() => {
    if (voiceMetrics.length === 0) return null;

    const recent = voiceMetrics.slice(-50);
    const avgVolume = recent.reduce((sum, m) => sum + m.volume, 0) / recent.length;
    const avgPitch = recent.reduce((sum, m) => sum + m.pitch, 0) / recent.length;
    const avgClarity = recent.reduce((sum, m) => sum + m.clarity, 0) / recent.length;
    const avgPace = recent.reduce((sum, m) => sum + m.pace, 0) / recent.length;

    return {
      averageVolume: Math.round(avgVolume),
      averagePitch: Math.round(avgPitch),
      averageClarity: Math.round(avgClarity),
      averagePace: Math.round(avgPace),
      sampleCount: recent.length,
      hasAdvancedMetrics: !!advancedMetrics,
      transcriptionLength: deepgramTranscription.length
    };
  }, [voiceMetrics, advancedMetrics, deepgramTranscription]);

  return {
    // Basic metrics
    audioLevel,
    isRecording,
    voiceMetrics,
    
    // Advanced metrics
    advancedMetrics,
    enhancedMetrics,
    realTimeAnalysis,
    deepgramTranscription,
    isAnalyzing,
    
    // Controls
    startRecording,
    stopRecording,
    toggleMute,
    resetAnalysis,
    
    // Analysis
    getVoiceAnalysisSummary,
    
    // Status
    hasDeepgramConnection: !!deepgramSocketRef.current,
    hasAdvancedAnalyzer: !!advancedAnalyzerRef.current,
    hasEnhancedAnalyzer: !!enhancedAnalyzerRef.current
  };
}
