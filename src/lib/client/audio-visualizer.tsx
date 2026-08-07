"use client";

import { useRef, useEffect, useCallback } from "react";

// ============================================
// Audio Spectrum Visualizer
// 
// Two modes:
//  - "analyser": accepts an AnalyserNode for live mic capture
//  - "source":   accepts an AudioNode for simulator playback
// ============================================

export interface VisualizerProps {
  /** AnalyserNode from live mic capture */
  analyser?: AnalyserNode | null;
  /** Audio source node for simulator playback */
  source?: AudioNode | null;
  /** AudioContext (needed when using source mode) */
  context?: AudioContext | null;
  /** Number of frequency bars */
  bars?: number;
  /** Bar color */
  color?: string;
  /** Height in pixels */
  height?: number;
  /** Whether audio is actively playing/capturing */
  active?: boolean;
  /** CSS class for the container */
  className?: string;
}

export function AudioVisualizer({
  analyser,
  source,
  context,
  bars = 64,
  color = "var(--hud-accent, #60a5fa)",
  height = 96,
  active = true,
  className = "",
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const internalAnalyserRef = useRef<AnalyserNode | null>(null);

  // Create internal analyser when source + context are provided
  useEffect(() => {
    if (source && context && !analyser) {
      try {
        const a = context.createAnalyser();
        a.fftSize = bars * 4;
        a.smoothingTimeConstant = 0.7;
        source.connect(a);
        internalAnalyserRef.current = a;
        return () => {
          a.disconnect();
          internalAnalyserRef.current = null;
        };
      } catch { /* ignore */ }
    }
  }, [source, context, analyser, bars]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
    }
    
    ctx.scale(dpr, dpr);
    
    const w = displayWidth;
    const h = displayHeight;
    const targetAnalyser = analyser || internalAnalyserRef.current;

    // Draw background
    ctx.clearRect(0, 0, w, h);

    if (!targetAnalyser || !active) {
      // Idle state — faint line at bottom
      ctx.fillStyle = color + "15";
      ctx.fillRect(0, h - 2, w, 2);
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const bufferLength = targetAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    targetAnalyser.getByteFrequencyData(dataArray);

    const barCount = bars;
    const barWidth = Math.max(2, (w / barCount) - 2);
    const gap = Math.max(1, (w - barCount * barWidth) / (barCount + 1));
    const step = Math.floor(bufferLength / barCount);

    // Draw bars
    for (let i = 0; i < barCount; i++) {
      const dataIdx = i * step;
      let value = 0;
      // Average over the frequency bin range
      const end = Math.min(dataIdx + step, bufferLength);
      let count = 0;
      for (let j = dataIdx; j < end; j++) {
        value += dataArray[j];
        count++;
      }
      value = count > 0 ? value / count : 0;

      // Normalize 0-255 to 0-1
      const normalized = value / 255;
      // Use a curve that emphasizes lower values (log-like)
      const barHeight = Math.max(2, normalized * h * 0.9);
      
      const x = gap + i * (barWidth + gap);
      const y = h - barHeight;

      // Gradient from solid to semi-transparent
      const grad = ctx.createLinearGradient(x, h, x, y);
      grad.addColorStop(0, color + "FF");
      grad.addColorStop(0.5, color + "AA");
      grad.addColorStop(1, color + "44");

      ctx.fillStyle = grad;
      
      // Rounded bar
      const radius = Math.min(2, barWidth / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, h);
      ctx.lineTo(x + barWidth - radius, h);
      ctx.quadraticCurveTo(x + barWidth, h, x + barWidth, h - radius);
      ctx.lineTo(x + barWidth, y + radius);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth - radius, y);
      ctx.lineTo(x + radius, y);
      ctx.quadraticCurveTo(x, y, x, y + radius);
      ctx.lineTo(x, h - radius);
      ctx.quadraticCurveTo(x, h, x + radius, h);
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [analyser, bars, color, active]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: "100%",
        height: `${height}px`,
        display: "block",
      }}
    />
  );
}
