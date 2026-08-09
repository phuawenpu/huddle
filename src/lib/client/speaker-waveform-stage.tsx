"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioVisualizer } from "./audio-visualizer";
import {
  speakerAtTime,
  speakerVisualStyle,
  type SpeakerTimelineTurn,
} from "./speaker-visuals";

interface WaveformSample {
  atMs: number;
  level: number;
  provisionalSpeakerLabel: string | null;
}

interface SpeakerWaveformStageProps {
  analyser: AnalyserNode | null;
  meter: number;
  active: boolean;
  activeSpeakerLabel: string | null;
  activeSpeakerName: string;
  liveText?: string;
  turns: SpeakerTimelineTurn[];
  getSpeakerName: (label: string) => string;
  historySeconds?: number;
}

const SAMPLE_INTERVAL_MS = 100;

export function SpeakerWaveformStage({
  analyser,
  meter,
  active,
  activeSpeakerLabel,
  activeSpeakerName,
  liveText,
  turns,
  getSpeakerName,
  historySeconds = 30,
}: SpeakerWaveformStageProps) {
  const [samples, setSamples] = useState<WaveformSample[]>([]);
  const meterRef = useRef(meter);
  const speakerRef = useRef(activeSpeakerLabel);
  const startedAtRef = useRef<number | null>(null);
  const labels = useMemo(
    () => [
      ...new Set(
        [
          ...turns.map((turn) => turn.providerSpeakerLabel),
          activeSpeakerLabel,
        ].filter((label): label is string => Boolean(label)),
      ),
    ],
    [activeSpeakerLabel, turns],
  );
  const activeStyle = speakerVisualStyle(activeSpeakerLabel, labels);

  useEffect(() => {
    meterRef.current = meter;
  }, [meter]);

  useEffect(() => {
    speakerRef.current = activeSpeakerLabel;
  }, [activeSpeakerLabel]);

  useEffect(() => {
    if (!active) {
      startedAtRef.current = null;
      return;
    }
    if (startedAtRef.current == null) startedAtRef.current = performance.now();
    const maximumSamples = Math.ceil(
      (historySeconds * 1000) / SAMPLE_INTERVAL_MS,
    );
    const interval = window.setInterval(() => {
      const startedAt = startedAtRef.current ?? performance.now();
      setSamples((current) => [
        ...current.slice(-(maximumSamples - 1)),
        {
          atMs: Math.max(0, performance.now() - startedAt),
          level: Math.max(0.025, Math.min(1, meterRef.current)),
          provisionalSpeakerLabel: speakerRef.current,
        },
      ]);
    }, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [active, historySeconds]);

  return (
    <section
      data-testid="speaker-waveform-stage"
      data-active-speaker={activeSpeakerLabel || "pending"}
      data-active-color={activeStyle.color}
      className="relative shrink-0 overflow-hidden border-b border-cyan-300/20 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.14),transparent_55%),linear-gradient(145deg,rgba(9,14,24,0.99),rgba(5,7,13,0.99))] px-3 py-2 sm:px-4"
      aria-label="Live speaker waveform"
    >
      <div className="mx-auto flex h-[clamp(140px,22dvh,200px)] max-w-5xl flex-col gap-1.5">
        <header className="flex min-h-6 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/75">
              Live audio
            </span>
            <span
              className="truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{
                borderColor: activeStyle.color,
                background: activeStyle.softColor,
                color: activeStyle.color,
              }}
            >
              {activeStyle.marker} {activeSpeakerName}
            </span>
          </div>
          <span className="shrink-0 text-[9px] uppercase tracking-wider text-hud-muted">
            {active ? "capturing now" : "ready"}
          </span>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <AudioVisualizer
            analyser={analyser}
            bars={64}
            height={78}
            active={active}
            color={activeStyle.color}
            className="h-full w-full opacity-95"
          />
          <div className="pointer-events-none absolute inset-x-2 bottom-1 flex items-end justify-between gap-2">
            <p className="min-w-0 truncate text-[10px] text-white/75">
              {liveText ||
                (active
                  ? activeSpeakerLabel
                    ? "Listening to the active speaker…"
                    : "Listening · identifying speaker…"
                  : "Start capture to see the room's audio signal.")}
            </p>
            <span className="shrink-0 text-[9px] tabular-nums text-white/45">
              {Math.round(meter * 100)}%
            </span>
          </div>
        </div>

        <SpeakerHistoryCanvas
          samples={samples}
          turns={turns}
          labels={labels}
          historySeconds={historySeconds}
          getSpeakerName={getSpeakerName}
        />
      </div>
    </section>
  );
}

function SpeakerHistoryCanvas({
  samples,
  turns,
  labels,
  historySeconds,
  getSpeakerName,
}: {
  samples: WaveformSample[];
  turns: SpeakerTimelineTurn[];
  labels: string[];
  historySeconds: number;
  getSpeakerName: (label: string) => string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestTurnMs = turns.reduce(
    (latest, turn) => Math.max(latest, turn.endMs || turn.startMs),
    0,
  );
  const latestSampleMs = samples.at(-1)?.atMs ?? 0;
  const throughMs = Math.max(latestTurnMs, latestSampleMs);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(255,255,255,0.025)";
    context.fillRect(0, 0, width, height);

    const windowMs = historySeconds * 1000;
    const windowStartMs = Math.max(0, throughMs - windowMs);
    const visibleSamples = samples.filter(
      (sample) => sample.atMs >= windowStartMs,
    );
    const columns = Math.max(
      1,
      Math.min(Math.floor(width / 3), visibleSamples.length || 96),
    );

    for (let index = 0; index < columns; index++) {
      const sample = visibleSamples.length
        ? visibleSamples[Math.floor((index / columns) * visibleSamples.length)]
        : undefined;
      const atMs = sample
        ? sample.atMs
        : windowStartMs + (index / Math.max(1, columns - 1)) * windowMs;
      const attribution = speakerAtTime(
        atMs,
        sample?.provisionalSpeakerLabel,
        turns,
      );
      const style = speakerVisualStyle(attribution.label, labels);
      const syntheticLevel = 0.16 + Math.abs(Math.sin(index * 0.57)) * 0.38;
      const level = sample
        ? sample.level
        : speakerAtTime(atMs, null, turns).label
          ? syntheticLevel
          : 0.035;
      const barHeight = Math.max(2, level * (height - 8));
      const x = (index / columns) * width;
      const barWidth = Math.max(1.5, width / columns - 1);
      const y = (height - barHeight) / 2;
      context.fillStyle = style.color;
      context.globalAlpha = attribution.label ? 0.88 : 0.32;
      context.fillRect(x, y, barWidth, barHeight);
      if (attribution.possibleOverlap) {
        context.globalAlpha = 0.9;
        context.strokeStyle = "#f8fafc";
        context.setLineDash([2, 2]);
        context.strokeRect(x, y, barWidth, barHeight);
        context.setLineDash([]);
      }
    }
    context.globalAlpha = 1;
    context.fillStyle = "rgba(255,255,255,0.42)";
    context.fillRect(width - 1, 0, 1, height);
  }, [historySeconds, labels, samples, throughMs, turns]);

  const visibleLabels = labels.slice(0, 6);
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <canvas
        ref={canvasRef}
        data-testid="speaker-waveform-history"
        className="h-9 w-full rounded-lg border border-white/10 bg-black/25"
        aria-label={`Recent ${historySeconds} second speaker waveform history`}
      />
      <div
        className="flex max-w-28 flex-wrap justify-end gap-x-1.5 gap-y-0.5"
        aria-label="Speaker color key"
      >
        {visibleLabels.map((label) => {
          const style = speakerVisualStyle(label, labels);
          return (
            <span
              key={label}
              className="max-w-14 truncate text-[8px] font-medium"
              style={{ color: style.color }}
              title={`${getSpeakerName(label)} · ${style.name}`}
            >
              {style.marker} {getSpeakerName(label)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
