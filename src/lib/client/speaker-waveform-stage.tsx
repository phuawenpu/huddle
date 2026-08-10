"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  isUnknownSpeakerLabel,
  rollingTalkShares,
  speakerAtTime,
  speakerInitial,
  speakerVisualStyle,
  type SpeakerTimelineTurn,
} from "./speaker-visuals";
import { AudioVisualizer } from "./audio-visualizer";

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
  captureStartedAtMs?: number | null;
  liveText?: string;
  turns: SpeakerTimelineTurn[];
  speakerLabels?: string[];
  detectedSpeakerLabels?: string[];
  focusedSpeakerLabel?: string | null;
  selectedTurnId?: string | null;
  emphasizedSpeakerLabels?: string[];
  getSpeakerName: (label: string) => string;
  onSpeakerFocus?: (label: string | null) => void;
  onTurnSelect?: (turnId: string) => void;
  historySeconds?: number;
}

const SAMPLE_INTERVAL_MS = 100;
const TALK_SHARE_WINDOW_MS = 5 * 60 * 1_000;

export function SpeakerWaveformStage({
  analyser,
  meter,
  active,
  activeSpeakerLabel,
  activeSpeakerName,
  captureStartedAtMs = null,
  liveText,
  turns,
  speakerLabels = [],
  detectedSpeakerLabels = [],
  focusedSpeakerLabel = null,
  selectedTurnId = null,
  emphasizedSpeakerLabels = [],
  getSpeakerName,
  onSpeakerFocus,
  onTurnSelect,
  historySeconds = 30,
}: SpeakerWaveformStageProps) {
  const [samples, setSamples] = useState<WaveformSample[]>([]);
  const meterRef = useRef(meter);
  const speakerRef = useRef(activeSpeakerLabel);
  const labels = useMemo(
    () => [
      ...new Set(
        [
          ...speakerLabels,
          ...turns.map((turn) => turn.providerSpeakerLabel),
          activeSpeakerLabel,
        ].filter(
          (label): label is string =>
            Boolean(label) && !isUnknownSpeakerLabel(label),
        ),
      ),
    ],
    [activeSpeakerLabel, speakerLabels, turns],
  );
  const activeStyle = speakerVisualStyle(activeSpeakerLabel, labels);
  const detectedLabels = useMemo(
    () =>
      new Set(
        [...detectedSpeakerLabels, activeSpeakerLabel].filter(
          (label): label is string =>
            Boolean(label) && !isUnknownSpeakerLabel(label),
        ),
      ),
    [activeSpeakerLabel, detectedSpeakerLabels],
  );
  const throughMs = Math.max(
    samples.at(-1)?.atMs || 0,
    ...turns.map((turn) => turn.endMs || turn.startMs),
    0,
  );
  const talkShares = useMemo(
    () => rollingTalkShares(turns, labels, throughMs, TALK_SHARE_WINDOW_MS),
    [labels, throughMs, turns],
  );

  useEffect(() => {
    meterRef.current = meter;
  }, [meter]);

  useEffect(() => {
    speakerRef.current = activeSpeakerLabel;
  }, [activeSpeakerLabel]);

  useEffect(() => {
    if (!active) return;
    const timelineStartedAt = captureStartedAtMs ?? performance.now();
    const maximumSamples = Math.ceil(
      (historySeconds * 1000) / SAMPLE_INTERVAL_MS,
    );
    const interval = window.setInterval(() => {
      setSamples((current) => [
        ...current.slice(-(maximumSamples - 1)),
        {
          atMs: Math.max(0, performance.now() - timelineStartedAt),
          level: Math.max(0, Math.min(1, meterRef.current)),
          provisionalSpeakerLabel: speakerRef.current,
        },
      ]);
    }, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [active, captureStartedAtMs, historySeconds]);

  return (
    <section
      data-testid="speaker-waveform-stage"
      data-active-speaker={activeSpeakerLabel || "pending"}
      data-active-color={activeStyle.color}
      className="relative shrink-0 overflow-hidden border-b border-cyan-300/15 bg-[radial-gradient(circle_at_18%_0%,rgba(91,141,255,0.13),transparent_48%),linear-gradient(145deg,rgba(10,17,29,0.99),rgba(5,9,17,0.99))] px-3 py-2.5 sm:px-4"
      aria-label="Live speaker and room-audio timeline"
    >
      <div className="mx-auto flex h-[clamp(158px,22dvh,198px)] max-w-5xl flex-col gap-2">
        <div
          className="grid auto-cols-[minmax(5rem,1fr)] grid-flow-col gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:auto-cols-[minmax(7.25rem,1fr)] sm:gap-2"
          aria-label="Recent participation, last five minutes"
        >
          {labels.length > 0 ? (
            labels.slice(0, 6).map((label) => {
              const name = getSpeakerName(label);
              const style = speakerVisualStyle(label, labels);
              const isSpeaking = active && activeSpeakerLabel === label;
              const isDetected = detectedLabels.has(label);
              const isFocused = focusedSpeakerLabel === label;
              const isEmphasized = emphasizedSpeakerLabels.includes(label);
              const hasSemanticEmphasis = emphasizedSpeakerLabels.length > 0;
              return (
                <button
                  key={label}
                  type="button"
                  aria-label={`${isFocused ? "Clear focus on" : "Focus"} ${name}`}
                  aria-pressed={isFocused}
                  data-testid="speaker-focus"
                  data-speaker-label={label}
                  data-speaker-color={style.color}
                  data-speaker-detected={isDetected ? "true" : "false"}
                  onClick={() => onSpeakerFocus?.(isFocused ? null : label)}
                  className={`group flex min-h-[54px] items-center gap-1.5 rounded-xl border bg-black/20 px-1.5 py-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-white/35 sm:min-h-[58px] sm:gap-2 sm:px-2 ${
                    isFocused
                      ? "border-white/40 bg-white/[0.07]"
                      : "border-white/10 hover:bg-white/[0.05]"
                  } ${
                    (focusedSpeakerLabel && !isFocused) ||
                    (!focusedSpeakerLabel &&
                      hasSemanticEmphasis &&
                      !isEmphasized)
                      ? "opacity-35"
                      : "opacity-100"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 bg-slate-950 text-xs font-bold shadow-[0_0_0_3px_rgba(255,255,255,0.025)] transition sm:h-10 sm:w-10 sm:text-sm ${isSpeaking ? "scale-105" : ""}`}
                    style={{
                      borderColor: style.color,
                      color: style.color,
                      boxShadow: isSpeaking
                        ? `0 0 18px ${style.color}80`
                        : undefined,
                    }}
                    aria-hidden="true"
                  >
                    {speakerInitial(name, label)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[10px] font-semibold text-white sm:text-xs"
                      style={{ color: isSpeaking ? style.color : undefined }}
                    >
                      {name === label ? `Speaker ${label}` : name}
                    </span>
                    <span
                      className="block truncate text-[10px] font-bold tabular-nums"
                      style={{ color: style.color }}
                      title="Share of finalized speaking time in the last five minutes"
                    >
                      {isDetected ? (
                        <>
                          {Math.round((talkShares[label] || 0) * 100)}% ·{" "}
                          <span className="font-normal text-hud-muted">
                            {isSpeaking ? "speaking" : "5 min"}
                          </span>
                        </>
                      ) : (
                        <span className="font-normal text-hud-muted">
                          awaiting voice
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="col-span-full flex min-h-[58px] items-center gap-3 rounded-xl border border-dashed border-white/10 px-3 text-xs text-hud-muted">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-slate-500 text-slate-400">
                ?
              </span>
              Participant identities appear as diarization resolves.
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-2 py-1.5">
          <div className="mb-1 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.14em]">
            <span className="font-semibold text-cyan-100/80">
              Live room spectrum
            </span>
            <span className="text-white/45">
              {detectedLabels.size}/{labels.length} speakers detected
            </span>
          </div>
          <AudioVisualizer
            analyser={analyser}
            bars={48}
            color={active ? activeStyle.color : "#64748b"}
            height={42}
            active={active}
            className="rounded-md bg-black/15"
            testId="speaker-spectrum"
            ariaLabel="Live room-audio frequency spectrum; color indicates the current attributed speaker"
          />
          <div className="mt-1 flex items-center gap-2">
            <span className="shrink-0 text-[8px] uppercase tracking-[0.12em] text-white/40">
              last {historySeconds}s
            </span>
            <SpeakerHistoryCanvas
              samples={samples}
              turns={turns}
              labels={labels}
              historySeconds={historySeconds}
              focusedSpeakerLabel={focusedSpeakerLabel}
              emphasizedSpeakerLabels={emphasizedSpeakerLabels}
              selectedTurnId={selectedTurnId}
              onTurnSelect={onTurnSelect}
              compact
            />
          </div>
        </div>

        <div className="flex min-h-4 items-center justify-between gap-2 text-[9px]">
          <p className="min-w-0 truncate text-white/65">
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{
                background: active ? activeStyle.color : "#64748b",
                boxShadow: active ? `0 0 8px ${activeStyle.color}` : undefined,
              }}
            />
            {liveText ||
              (active
                ? activeSpeakerLabel
                  ? `${activeSpeakerName} · listening in real time`
                  : "Listening in real time · speaker resolving"
                : "Ready · color is speaker attribution; height is loudness")}
          </p>
          <span className="shrink-0 text-white/40">
            {focusedSpeakerLabel
              ? "Speaker focus on"
              : "Tap a speaker to focus"}
          </span>
        </div>
      </div>
    </section>
  );
}

function SpeakerHistoryCanvas({
  samples,
  turns,
  labels,
  historySeconds,
  focusedSpeakerLabel,
  emphasizedSpeakerLabels,
  selectedTurnId,
  onTurnSelect,
  compact = false,
}: {
  samples: WaveformSample[];
  turns: SpeakerTimelineTurn[];
  labels: string[];
  historySeconds: number;
  focusedSpeakerLabel: string | null;
  emphasizedSpeakerLabels: string[];
  selectedTurnId: string | null;
  onTurnSelect?: (turnId: string) => void;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestTurnMs = turns.reduce(
    (latest, turn) => Math.max(latest, turn.endMs || turn.startMs),
    0,
  );
  const latestSampleMs = samples.at(-1)?.atMs ?? 0;
  const throughMs = Math.max(latestTurnMs, latestSampleMs);
  const windowMs = historySeconds * 1000;
  const windowStartMs = Math.max(0, throughMs - windowMs);

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
    context.fillStyle = "rgba(255,255,255,0.018)";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(255,255,255,0.09)";
    context.beginPath();
    context.moveTo(0, height - 0.5);
    context.lineTo(width, height - 0.5);
    context.stroke();

    const visibleSamples = samples.filter(
      (sample) => sample.atMs >= windowStartMs,
    );
    const columns = Math.max(
      1,
      Math.min(Math.floor(width / 2.5), visibleSamples.length || 120),
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
      const level = sample?.level || 0;
      const barHeight = Math.max(level > 0 ? 2 : 1, level * (height - 8));
      const x = (index / columns) * width;
      const barWidth = Math.max(1.25, width / columns - 0.55);
      const y = height - barHeight;
      context.fillStyle = sample ? style.color : "#64748b";
      context.globalAlpha =
        (focusedSpeakerLabel && attribution.label !== focusedSpeakerLabel) ||
        (!focusedSpeakerLabel &&
          emphasizedSpeakerLabels.length > 0 &&
          !emphasizedSpeakerLabels.includes(attribution.label || ""))
          ? 0.16
          : sample && attribution.label
            ? 0.9
            : 0.25;
      context.fillRect(x, y, barWidth, barHeight);
      if (attribution.possibleOverlap) {
        context.globalAlpha = 0.92;
        context.strokeStyle = "#f8fafc";
        context.setLineDash([2, 2]);
        context.strokeRect(x, Math.max(1, y - 1), barWidth, barHeight + 2);
        context.setLineDash([]);
      }
    }

    const selectedTurn = turns.find((turn) => turn.id === selectedTurnId);
    if (selectedTurn) {
      const startX =
        ((Math.max(windowStartMs, selectedTurn.startMs) - windowStartMs) /
          windowMs) *
        width;
      const endX =
        ((Math.min(throughMs, selectedTurn.endMs) - windowStartMs) / windowMs) *
        width;
      context.globalAlpha = 1;
      context.strokeStyle = "#f8fafc";
      context.lineWidth = 1.5;
      context.strokeRect(
        Math.max(0, startX),
        1,
        Math.max(3, endX - startX),
        height - 2,
      );
    }

    context.globalAlpha = 1;
    context.fillStyle = "rgba(255,255,255,0.62)";
    context.fillRect(width - 1, 0, 1, height);
  }, [
    focusedSpeakerLabel,
    emphasizedSpeakerLabels,
    historySeconds,
    labels,
    samples,
    selectedTurnId,
    throughMs,
    turns,
    windowMs,
    windowStartMs,
  ]);

  const selectAtClientX = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || turns.length === 0) return;
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (clientX - bounds.left) / bounds.width),
    );
    const atMs = windowStartMs + ratio * windowMs;
    const turn = [...turns]
      .reverse()
      .find(
        (candidate) => atMs >= candidate.startMs && atMs <= candidate.endMs,
      );
    if (turn?.id) {
      onTurnSelect?.(turn.id);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      data-testid="speaker-waveform-history"
      data-selected-turn={selectedTurnId || ""}
      className={`${compact ? "h-3" : "h-12"} w-full cursor-crosshair rounded-sm bg-black/15 focus:outline-none focus:ring-2 focus:ring-cyan-300/40`}
      aria-label={`Recent ${historySeconds} second shared-room waveform. Select a region to locate its transcript turn.`}
      role="button"
      tabIndex={turns.length > 0 ? 0 : -1}
      onClick={(event) => selectAtClientX(event.clientX)}
      onKeyDown={(event) => {
        const latest = turns.at(-1);
        if ((event.key === "Enter" || event.key === " ") && latest?.id) {
          event.preventDefault();
          onTurnSelect?.(latest.id);
        }
      }}
    />
  );
}
