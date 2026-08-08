"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioCaptureOptions {
  onPcm16: (buffer: ArrayBuffer, frameIndex: number) => void;
  onError?: (error: Error) => void;
  onSettingsReadback?: (settings: MediaTrackSettings) => void;
  onSourceEnded?: () => void;
  targetSampleRate?: number;
  frameMs?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioCaptureState {
  isCapturing: boolean;
  sourceKind: "microphone" | "recording" | null;
  settings: MediaTrackSettings | null;
  meter: number;
  error: string | null;
  workletLoaded: boolean;
  analyserNode: AnalyserNode | null;
}

export function useAudioCapture(options: AudioCaptureOptions) {
  const {
    onPcm16,
    onError,
    onSettingsReadback,
    onSourceEnded,
    targetSampleRate = 16000,
    frameMs = 50,
    echoCancellation = true,
    noiseSuppression = true,
    autoGainControl = true,
  } = options;

  const [state, setState] = useState<AudioCaptureState>({
    isCapturing: false,
    sourceKind: null,
    settings: null,
    meter: 0,
    error: null,
    workletLoaded: false,
    analyserNode: null,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioNode | null>(null);
  const fileSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sinkGainRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const meterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingRef = useRef(false);
  const onPcm16Ref = useRef(onPcm16);
  const onSourceEndedRef = useRef(onSourceEnded);
  onPcm16Ref.current = onPcm16;
  onSourceEndedRef.current = onSourceEnded;

  const checkBaseCapabilities = useCallback(() => {
    const missing: string[] = [];
    if (typeof window === "undefined") return missing;
    if (
      typeof window.AudioContext === "undefined" &&
      typeof (window as any).webkitAudioContext === "undefined"
    ) {
      missing.push("AudioContext");
    }
    return missing;
  }, []);

  const cleanup = useCallback((stopFileSource = true) => {
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
    if (fileSourceRef.current) {
      fileSourceRef.current.onended = null;
      if (stopFileSource) {
        try {
          fileSourceRef.current.stop();
        } catch {
          // A source that already ended cannot be stopped twice.
        }
      }
      fileSourceRef.current.disconnect();
      fileSourceRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    workletNodeRef.current?.port.postMessage({ type: "stop" });
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    sinkGainRef.current?.disconnect();
    sinkGainRef.current = null;
    monitorGainRef.current?.disconnect();
    monitorGainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (contextRef.current && contextRef.current.state !== "closed") {
      contextRef.current.close().catch(() => {});
    }
    contextRef.current = null;
    startingRef.current = false;
    setState((current) => ({
      ...current,
      isCapturing: false,
      sourceKind: null,
      meter: 0,
      workletLoaded: false,
      analyserNode: null,
    }));
  }, []);

  const createContext = useCallback(async () => {
    const missing = checkBaseCapabilities();
    if (missing.length) {
      throw new Error(
        `Missing browser capabilities: ${missing.join(", ")}. Please use a current browser.`
      );
    }
    const AudioContextConstructor =
      window.AudioContext || (window as any).webkitAudioContext;
    const context: AudioContext = new AudioContextConstructor();
    contextRef.current = context;
    if (context.state === "suspended") await context.resume();
    if (!context.audioWorklet) {
      throw new Error("AudioWorklet is unavailable. Open this page over HTTPS in a current browser.");
    }
    await context.audioWorklet.addModule("/worklets/pcm-resampler.js");
    return context;
  }, [checkBaseCapabilities]);

  const connectSource = useCallback(
    (
      context: AudioContext,
      source: AudioNode,
      sourceKind: "microphone" | "recording",
      monitor: boolean
    ) => {
      const worklet = new AudioWorkletNode(context, "pcm-resampler");
      workletNodeRef.current = worklet;
      worklet.port.postMessage({ type: "setTargetRate", rate: targetSampleRate });
      worklet.port.postMessage({ type: "setFrameMs", ms: frameMs });
      worklet.port.onmessage = (event) => {
        if (event.data.type === "pcm16") {
          onPcm16Ref.current(event.data.buffer, event.data.frameIndex);
        }
      };

      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      sourceRef.current = source;
      source.connect(analyser);
      source.connect(worklet);

      // AudioWorklet graphs are pull-driven. Connecting a zero-gain sink keeps
      // PCM processing alive without feeding the microphone back to speakers.
      const sinkGain = context.createGain();
      sinkGain.gain.value = 0;
      sinkGainRef.current = sinkGain;
      worklet.connect(sinkGain);
      sinkGain.connect(context.destination);

      if (monitor) {
        const monitorGain = context.createGain();
        monitorGain.gain.value = 0.8;
        monitorGainRef.current = monitorGain;
        source.connect(monitorGain);
        monitorGain.connect(context.destination);
      }

      const data = new Uint8Array(analyser.frequencyBinCount);
      meterIntervalRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const sample of data) {
          const value = (sample - 128) / 128;
          sum += value * value;
        }
        const meter = Math.min(1, Math.sqrt(sum / data.length) * 2);
        setState((current) => ({ ...current, meter }));
      }, 100);

      startingRef.current = false;
      setState((current) => ({
        ...current,
        error: null,
        isCapturing: true,
        sourceKind,
        workletLoaded: true,
        analyserNode: analyser,
      }));
    },
    [frameMs, targetSampleRate]
  );

  const start = useCallback(async () => {
    if (startingRef.current || state.isCapturing) return;
    startingRef.current = true;
    setState((current) => ({ ...current, error: null }));
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is unavailable. Open this page over HTTPS and allow microphone access.");
      }
      // Create/resume the context at the start of the click handler so mobile
      // browsers retain the user activation needed for audio.
      const contextPromise = createContext();
      const streamPromise = navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: targetSampleRate },
        },
        video: false,
      });
      const [contextResult, streamResult] = await Promise.allSettled([
        contextPromise,
        streamPromise,
      ]);
      if (contextResult.status === "rejected" || streamResult.status === "rejected") {
        if (streamResult.status === "fulfilled") {
          streamResult.value.getTracks().forEach((track) => track.stop());
        }
        throw (
          contextResult.status === "rejected"
            ? contextResult.reason
            : streamResult.status === "rejected"
              ? streamResult.reason
              : new Error("Microphone startup failed.")
        );
      }
      const context = contextResult.value;
      const stream = streamResult.value;
      streamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error("The browser returned no microphone audio track.");
      const actualSettings = track.getSettings();
      setState((current) => ({ ...current, settings: actualSettings }));
      onSettingsReadback?.(actualSettings);
      connectSource(
        context,
        context.createMediaStreamSource(stream),
        "microphone",
        false
      );
    } catch (error: any) {
      cleanup();
      const normalized = error instanceof Error ? error : new Error(String(error));
      setState((current) => ({ ...current, error: normalized.message }));
      onError?.(normalized);
      throw normalized;
    }
  }, [
    state.isCapturing,
    createContext,
    echoCancellation,
    noiseSuppression,
    autoGainControl,
    targetSampleRate,
    onSettingsReadback,
    connectSource,
    cleanup,
    onError,
  ]);

  const startRecording = useCallback(
    async (url: string) => {
      if (startingRef.current || state.isCapturing) return;
      startingRef.current = true;
      setState((current) => ({ ...current, error: null }));
      try {
        const context = await createContext();
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.error || `Could not load recording (${response.status}).`);
        }
        const decoded = await context.decodeAudioData(await response.arrayBuffer());
        const source = context.createBufferSource();
        source.buffer = decoded;
        fileSourceRef.current = source;
        connectSource(context, source, "recording", true);
        source.onended = () => {
          cleanup(false);
          onSourceEndedRef.current?.();
        };
        source.start();
      } catch (error: any) {
        cleanup();
        const normalized = error instanceof Error ? error : new Error(String(error));
        setState((current) => ({ ...current, error: normalized.message }));
        onError?.(normalized);
        throw normalized;
      }
    },
    [state.isCapturing, createContext, connectSource, cleanup, onError]
  );

  const stop = useCallback(() => cleanup(true), [cleanup]);

  useEffect(() => () => cleanup(true), [cleanup]);

  return { ...state, start, startRecording, stop };
}
