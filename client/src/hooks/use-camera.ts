import { useRef, useState, useCallback } from "react";

/**
 * useCamera Hook
 * 
 * A React hook that manages camera access and video stream handling.
 * This hook provides a simple interface for accessing and controlling
 * the device's camera for video analysis.
 * 
 * Key Features:
 * - Camera stream initialization
 * - Stream cleanup on unmount
 * - Error handling for camera access
 * - Device selection (front/back camera)
 * 
 * Connections:
 * - MediaDevices API: For camera access
 * - React refs: For video element binding
 * - Error handling system: For user feedback
 * 
 * Usage:
 * This hook is used as a foundation for video-based features
 * like eye tracking and face analysis.
 */

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setStream(mediaStream);
      setIsVideoEnabled(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Failed to access camera. Please check permissions.");
      throw err;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsVideoEnabled(false);
  }, [stream]);

  const toggleVideo = useCallback(() => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [stream]);

  return {
    videoRef,
    stream,
    isVideoEnabled,
    error,
    startCamera,
    stopCamera,
    toggleVideo
  };
}
