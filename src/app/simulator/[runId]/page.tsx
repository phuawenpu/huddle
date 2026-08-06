"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface RunData {
  id: string;
  sessionId: string;
  scenarioId?: string;
  mode: string;
  stubbed: boolean;
  status: string;
}

interface ScenarioData {
  id: string;
  title: string;
  speakers?: Array<{ index: number; name: string }>;
  turns?: Array<{ index: number; speakerIndex: number; text: string }>;
  durationMinutes: number;
  speakerCount: number;
}

export default function SimulatorPage() {
  const params = useParams<{ runId: string }>();
  const router = useRouter();
  const runId = params.runId;

  const [run, setRun] = useState<RunData | null>(null);
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [status, setStatus] = useState("loading");
  const [currentTurn, setCurrentTurn] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const rRes = await fetch(`/api/runs/${runId}`);
        if (!rRes.ok) throw new Error("Run not found");
        const runData = await rRes.json();
        setRun(runData);

        if (runData.scenarioId) {
          const sRes = await fetch(`/api/scenarios/${runData.scenarioId}`);
          if (sRes.ok) {
            const sData = await sRes.json();
            setScenario(sData);
          }
        }
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    };
    load();
  }, [runId]);

  const startPlayback = async () => {
    setStatus("playing");
    await fetch(`/api/runs/${runId}/playback`, { method: "POST" });

    if (!scenario?.turns) return;

    let turnIdx = 0;
    const advanceTurn = () => {
      if (turnIdx >= scenario.turns!.length) {
        setStatus("complete");
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      setCurrentTurn(turnIdx);
      const turn = scenario.turns![turnIdx];
      // Simulate turn duration based on text length (~150 chars per second for display)
      const durationMs = Math.max(2000, turn.text.length * 60 / playbackSpeed);
      setElapsed(prev => prev + durationMs);
      turnIdx++;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(advanceTurn, durationMs);
    };

    advanceTurn();
  };

  const stopPlayback = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("stopped");
    setCurrentTurn(null);
  };

  const restartPlayback = () => {
    stopPlayback();
    setElapsed(0);
    setCurrentTurn(null);
    startPlayback();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  if (status === "loading") {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4 bg-hud-bg">
        <div className="text-hud-muted animate-pulse">Loading simulator…</div>
      </main>
    );
  }

  if (status === "error" || !run) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-4 bg-hud-bg gap-4">
        <div className="text-hud-danger">Failed to load run</div>
        <button onClick={() => router.push("/")} className="text-hud-accent touch-manipulation" style={{ minHeight: 44 }}>
          Go Home
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-hud-bg text-hud-text flex flex-col" style={{ overscrollBehavior: "none" }}>
      {/* SIMULATION Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-hud-border safe-top bg-hud-sim-badge/10">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <span className="px-2 py-0.5 bg-hud-sim-badge/20 text-hud-sim-badge rounded text-xs">
              ◆ SIMULATION
            </span>
            Simulator
          </h1>
          <p className="text-xs text-hud-muted">
            {scenario?.title || "Unknown"} · {scenario?.durationMinutes || "?"}min · {scenario?.speakerCount || "?"} speakers
          </p>
        </div>
        <button
          onClick={() => router.push(`/runs/${runId}/results`)}
          className="px-3 py-2 text-xs bg-hud-surface border border-hud-border rounded-lg touch-manipulation"
          style={{ minHeight: 40 }}
        >
          Results →
        </button>
      </header>

      {/* Playback Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-6">
        {/* Status */}
        <div className="text-center">
          <div className={`text-lg font-mono ${
            status === "playing" ? "text-hud-success" :
            status === "complete" ? "text-hud-accent" :
            status === "stopped" ? "text-hud-muted" :
            "text-hud-text"
          }`}>
            {status === "ready" && "Ready"}
            {status === "playing" && `Playing · ${formatTime(elapsed)}`}
            {status === "complete" && "Complete ✓"}
            {status === "stopped" && "Stopped"}
          </div>
        </div>

        {/* Current Turn Display */}
        {currentTurn != null && scenario?.turns?.[currentTurn] && (
          <div className="w-full max-w-lg bg-hud-surface border border-hud-border rounded-xl p-6 transition-opacity duration-300">
            <div className="flex items-center gap-2 mb-3">
              {(() => {
                const turn = scenario.turns[currentTurn];
                const speaker = scenario.speakers?.find(s => s.index === turn.speakerIndex);
                return (
                  <span className="px-3 py-1 bg-hud-accent/20 text-hud-accent rounded-full text-sm font-medium">
                    {speaker?.name || `Speaker ${turn.speakerIndex}`}
                  </span>
                );
              })()}
              <span className="text-xs text-hud-muted">
                Turn {currentTurn + 1} of {scenario.turns.length}
              </span>
            </div>
            <p className="text-hud-text text-lg leading-relaxed">
              {scenario.turns[currentTurn].text}
            </p>
          </div>
        )}

        {/* Progress bar */}
        {scenario?.turns && (
          <div className="w-full max-w-lg bg-hud-surface rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-hud-accent transition-all duration-300"
              style={{ width: `${currentTurn != null ? ((currentTurn + 1) / scenario.turns.length * 100) : 0}%` }}
            />
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          {status === "ready" && (
            <button
              onClick={startPlayback}
              className="px-8 py-4 bg-hud-accent text-white rounded-xl font-semibold text-lg
                hover:bg-hud-accent-dim active:scale-[0.98] transition-all touch-manipulation"
              style={{ minHeight: 56, minWidth: 120 }}
            >
              ▶ Start
            </button>
          )}
          {(status === "playing" || status === "stopped" || status === "complete") && (
            <>
              {status === "playing" ? (
                <button
                  onClick={stopPlayback}
                  className="px-6 py-4 bg-hud-surface border border-hud-border rounded-xl font-semibold
                    hover:border-hud-accent transition-all touch-manipulation"
                  style={{ minHeight: 56, minWidth: 100 }}
                >
                  ⏸ Stop
                </button>
              ) : (
                <button
                  onClick={status === "complete" ? restartPlayback : startPlayback}
                  className="px-6 py-4 bg-hud-accent text-white rounded-xl font-semibold
                    hover:bg-hud-accent-dim transition-all touch-manipulation"
                  style={{ minHeight: 56, minWidth: 100 }}
                >
                  ▶ {status === "complete" ? "Restart" : "Resume"}
                </button>
              )}
              <button
                onClick={restartPlayback}
                className="px-6 py-4 bg-hud-surface border border-hud-border rounded-xl font-semibold
                  hover:border-hud-accent transition-all touch-manipulation"
                style={{ minHeight: 56, minWidth: 100 }}
              >
                ↺ Restart
              </button>
            </>
          )}
        </div>

        {/* Speed control */}
        <div className="flex gap-2">
          {[0.5, 1.0, 1.5, 2.0].map(speed => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-3 py-1 rounded-lg text-xs border transition-all touch-manipulation ${
                playbackSpeed === speed
                  ? "bg-hud-accent text-white border-hud-accent"
                  : "bg-hud-surface text-hud-text border-hud-border hover:border-hud-accent"
              }`}
              style={{ minHeight: 36 }}
            >
              {speed}×
            </button>
          ))}
        </div>

        {/* Script toggle */}
        <details className="w-full max-w-lg">
          <summary className="text-sm text-hud-muted cursor-pointer hover:text-hud-text touch-manipulation"
            style={{ minHeight: 36 }}>
            Show full script ({scenario?.turns?.length || 0} turns)
          </summary>
          <div className="mt-2 max-h-64 overflow-y-auto space-y-1 bg-hud-surface rounded-xl p-3 border border-hud-border">
            {scenario?.turns?.map(t => {
              const speaker = scenario.speakers?.find(s => s.index === t.speakerIndex);
              return (
                <div key={t.index} className={`py-1 text-xs flex gap-2 ${
                  currentTurn === t.index ? "text-hud-accent" : "text-hud-muted"
                }`}>
                  <span className="font-mono w-14 flex-shrink-0">{speaker?.name || `S${t.speakerIndex}`}</span>
                  <span>{t.text.length > 60 ? t.text.slice(0, 60) + "…" : t.text}</span>
                </div>
              );
            })}
          </div>
        </details>
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 border-t border-hud-border safe-bottom text-center text-xs text-hud-muted">
        <p>AI-generated voices — not a live discussion</p>
      </div>
    </main>
  );
}
