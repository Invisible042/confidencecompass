import { useState, useCallback, useRef } from "react";
import { VoiceMetric } from "@shared/schema";

export function useVoiceAnalyzer() {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetric[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate volume level (0-100)
    const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
    const volume = Math.min(100, (average / 255) * 100 * 2); // Amplify for better visualization
    
    setAudioLevel(volume);

    // Generate voice metrics (simplified for demo)
    const metric: VoiceMetric = {
      volume: volume,
      pitch: Math.random() * 100, // In real implementation, this would be calculated from audio
      clarity: Math.max(0, volume + Math.random() * 20 - 10), // Simplified clarity calculation
      pace: Math.random() * 100, // Would be calculated from speech rate
      timestamp: Date.now()
    };

    setVoiceMetrics(prev => [...prev.slice(-100), metric]); // Keep last 100 metrics

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      setIsRecording(true);
      analyzeAudio();
    } catch (error) {
      console.error("Error starting audio recording:", error);
      throw error;
    }
  }, [analyzeAudio]);

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
    
    analyserRef.current = null;
    setIsRecording(false);
    setAudioLevel(0);
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

  return {
    audioLevel,
    isRecording,
    voiceMetrics,
    startRecording,
    stopRecording,
    toggleMute
  };
}
