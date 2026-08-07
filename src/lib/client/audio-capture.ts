"use client";

/**
 * Audio Capture Hook — getUserMedia + AudioWorklet for PCM16
 * 
 * Usage:
 *   const { start, stop, isCapturing, settings, meter, error } = useAudioCapture({
 *     onPcm16: (buffer: ArrayBuffer, frameIndex: number) => { ... },
 *   });
 */

import { useRef, useState, useCallback, useEffect } from "react";

export interface AudioCaptureOptions {
  onPcm16: (buffer: ArrayBuffer, frameIndex: number) => void;
  onError?: (error: Error) => void;
  onSettingsReadback?: (settings: MediaTrackSettings) => void;
  targetSampleRate?: number;
  frameMs?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioCaptureState {
  isCapturing: boolean;
  settings: MediaTrackSettings | null;
  meter: number; // 0.0 - 1.0
  error: string | null;
  workletLoaded: boolean;
  analyserNode: AnalyserNode | null;
}

export function useAudioCapture(options: AudioCaptureOptions) {
  const {
    onPcm16,
    onError,
    onSettingsReadback,
    targetSampleRate = 16000,
    frameMs = 50,
    echoCancellation = true,
    noiseSuppression = true,
    autoGainControl = true,
  } = options;

  const [state, setState] = useState<AudioCaptureState>({
    isCapturing: false,
    settings: null,
    meter: 0,
    error: null,
    workletLoaded: false,
    analyserNode: null,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  
  const meterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onPcm16Ref = useRef(onPcm16);
  onPcm16Ref.current = onPcm16;

  // Feature detection
  const checkCapabilities = useCallback(() => {
    const missing: string[] = [];
    if (typeof navigator === "undefined") return missing;
    if (!navigator.mediaDevices?.getUserMedia) missing.push("getUserMedia");
    if (typeof AudioContext === "undefined" && typeof (window as any).webkitAudioContext === "undefined") {
      missing.push("AudioContext");
    }
    if (typeof AudioWorklet === "undefined") missing.push("AudioWorklet");
    return missing;
  }, []);

  // Start capture
  const start = useCallback(async () => {
    try {
      setState(s => ({ ...s, error: null }));

      const missing = checkCapabilities();
      if (missing.length > 0) {
        throw new Error(`Missing browser capabilities: ${missing.join(", ")}. Please use a current browser.`);
      }

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: targetSampleRate },
        },
        video: false,
      });
      streamRef.current = stream;

      // Read back actual settings
      const track = stream.getAudioTracks()[0];
      const actualSettings = track.getSettings();
      setState(s => ({ ...s, settings: actualSettings }));
      onSettingsReadback?.(actualSettings);

      // Create AudioContext (will be at hardware rate, worklet resamples)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioCtx();
      contextRef.current = context;

      // Resume if suspended (iOS)
      if (context.state === "suspended") {
        await context.resume();
      }

      // Load AudioWorklet
      await context.audioWorklet.addModule("/worklets/pcm-resampler.js");
      setState(s => ({ ...s, workletLoaded: true }));

      // Create worklet node
      const workletNode = new AudioWorkletNode(context, "pcm-resampler");
      workletNodeRef.current = workletNode;

      // Send target config to worklet
      workletNode.port.postMessage({ type: "setTargetRate", rate: targetSampleRate });
      workletNode.port.postMessage({ type: "setFrameMs", ms: frameMs });

      // Handle PCM16 frames from worklet
      workletNode.port.onmessage = (e) => {
        if (e.data.type === "pcm16") {
          onPcm16Ref.current(e.data.buffer, e.data.frameIndex);
        }
      };

      // Create source and connect through worklet
      const source = context.createMediaStreamSource(stream);
      
      // Analyser for meter
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      source.connect(analyser);
      source.connect(workletNode);

      // Expose analyser for visualizer
      if (!analyserRef.current) analyserRef.current = analyser;
      // Worklet has no output connection (we only use its MessagePort)

      // Meter polling (every 100ms)
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      meterIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setState(s => ({ ...s, meter: Math.min(1, rms * 2) })); // Scale for visibility
      }, 100);

      setState(s => ({ ...s, isCapturing: true, analyserNode: analyser || null }));

    } catch (err: any) {
      const message = err.message || "Failed to start audio capture";
      setState(s => ({ ...s, error: message, isCapturing: false }));
      onError?.(err);
    }
  }, [targetSampleRate, frameMs, echoCancellation, noiseSuppression, autoGainControl, checkCapabilities, onError, onSettingsReadback]);

  // Stop capture
  const stop = useCallback(() => {
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (contextRef.current && contextRef.current.state !== "closed") {
      contextRef.current.close().catch(() => {});
      contextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    setState(s => ({
      ...s,
      isCapturing: false,
      meter: 0,
      workletLoaded: false,
    analyserNode: null,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (meterIntervalRef.current) clearInterval(meterIntervalRef.current);
      if (contextRef.current?.state !== "closed") {
        contextRef.current?.close().catch(() => {});
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return { ...state, start, stop };
}
