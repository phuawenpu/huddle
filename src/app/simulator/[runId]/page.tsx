"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWakeLock } from "@/lib/client/wake-lock";

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
  speakers?: Array<{ index: number; name: string; voiceId: string }>;
  turns?: Array<{ index: number; speakerIndex: number; text: string; startMs?: number; endMs?: number }>;
  durationMinutes: number;
  speakerCount: number;
  realizedDurationMs?: number;
}

export default function SimulatorPage() {
  const params = useParams<{ runId: string }>();
  const router = useRouter();
  const runId = params.runId;

  const [run, setRun] = useState<RunData | null>(null);
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [currentTurn, setCurrentTurn] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [audioReady, setAudioReady] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentTurnIdxRef = useRef<number>(0);

  const { locked, supported, acquire } = useWakeLock();

  // Load run and scenario data
  useEffect(() => {
    const load = async () => {
      try {
        const [rRes, synthedScenarios] = await Promise.all([
          fetch(`/api/runs/${runId}`),
          fetch("/api/recordings"),
        ]);
        
        if (!rRes.ok) throw new Error("Run not found");
        const runData = await rRes.json();
        setRun(runData);

        if (runData.scenarioId) {
          const sRes = await fetch(`/api/scenarios/${runData.scenarioId}`);
          if (sRes.ok) {
            const sData = await sRes.json();
            setScenario(sData);
            // Set the mixed audio URL
            setMixedAudioUrl(`/api/scenarios/${runData.scenarioId}/mixed?format=wav`);
          }
        }
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    };
    load();
  }, [runId]);

  // Load audio buffer
  const loadAudio = useCallback(async () => {
    if (!mixedAudioUrl) return;
    
    setAudioLoading(true);
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;

      // Resume if suspended (iOS)
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const response = await fetch(mixedAudioUrl);
      if (!response.ok) throw new Error(`Audio not found (${response.status})`);
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBufferRef.current = audioBuffer;
      setAudioReady(true);
      setAudioLoading(false);
    } catch (err: any) {
      console.error("Audio load failed:", err);
      setAudioLoading(false);
      // Fall back to turn-based visual playback
      setAudioReady(false);
    }
  }, [mixedAudioUrl]);

  // Preload audio when ready
  useEffect(() => {
    if (status === "ready" && mixedAudioUrl) {
      loadAudio();
    }
  }, [status, mixedAudioUrl, loadAudio]);

  // Start playback
  const startPlayback = useCallback(async () => {
    await fetch(`/api/runs/${runId}/playback`, { method: "POST" });
    await acquire();

    const ctx = audioContextRef.current;
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }

    // Try audio playback first
    if (audioBufferRef.current && ctx) {
      // Stop any existing source
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch {}
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.playbackRate.value = playbackSpeed;
      source.connect(ctx.destination);
      
      const duration = audioBufferRef.current.duration / playbackSpeed;
      setStatus("playing");
      startTimeRef.current = ctx.currentTime;
      sourceNodeRef.current = source;

      // Track elapsed time
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = setInterval(() => {
        const elapsed = (ctx.currentTime - startTimeRef.current) * 1000 * playbackSpeed;
        setElapsed(Math.round(elapsed));

        // Update current turn based on audio position
        if (scenario?.turns) {
          for (let i = scenario.turns.length - 1; i >= 0; i--) {
            const turn = scenario.turns[i];
            const tStart = turn.startMs || 0;
            if (elapsed >= tStart) {
              if (i !== currentTurnIdxRef.current) {
                currentTurnIdxRef.current = i;
                setCurrentTurn(i);
              }
              break;
            }
          }
        }
      }, 100);

      source.onended = () => {
        setStatus("complete");
        setElapsed(Math.round(duration * 1000));
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      };

      source.start(0);
    } else {
      // Fall back to visual-only turn-by-turn playback
      startVisualPlayback();
    }
  }, [runId, acquire, playbackSpeed, scenario, audioReady]);

  // Visual-only playback fallback
  const startVisualPlayback = useCallback(async () => {
    if (!scenario?.turns) return;
    
    setStatus("playing");
    await acquire();

    let turnIdx = 0;
    currentTurnIdxRef.current = 0;
    
    const advanceTurn = () => {
      if (turnIdx >= scenario.turns!.length) {
        setStatus("complete");
        if (turnTimerRef.current) clearInterval(turnTimerRef.current);
        return;
      }
      setCurrentTurn(turnIdx);
      currentTurnIdxRef.current = turnIdx;
      
      const turn = scenario.turns![turnIdx];
      const durationMs = Math.max(2000, (turn.endMs || 0) - (turn.startMs || 0)) / playbackSpeed;
      setElapsed(prev => prev + durationMs);
      turnIdx++;
      
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      turnTimerRef.current = setTimeout(advanceTurn, durationMs);
    };
    
    advanceTurn();
  }, [scenario, playbackSpeed, acquire]);

  // Pause
  const pausePlayback = useCallback(() => {
    if (sourceNodeRef.current && audioContextRef.current) {
      // Can't truly pause, so stop and track position
      const ctx = audioContextRef.current;
      const elapsed = (ctx.currentTime - startTimeRef.current) * 1000 * playbackSpeed;
      setElapsed(Math.round(elapsed));
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (turnTimerRef.current) clearInterval(turnTimerRef.current);
    setStatus("paused");
  }, [playbackSpeed]);

  // Stop
  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (turnTimerRef.current) clearInterval(turnTimerRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setStatus("stopped");
    setElapsed(0);
    setCurrentTurn(null);
    currentTurnIdxRef.current = 0;
    setAudioReady(false);
    audioBufferRef.current = null;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch {}
      }
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  const currentSpeaker = scenario?.speakers && currentTurn !== null && scenario.turns
    ? scenario.speakers[scenario.turns[currentTurn]?.speakerIndex]?.name
    : null;

  const totalDurationMs = scenario?.realizedDurationMs || (scenario?.durationMinutes || 0) * 60000;
  const progress = totalDurationMs > 0 ? Math.min(100, (elapsed / totalDurationMs) * 100) : 0;

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (status === "loading") return (
    <main className="min-h-dvh flex items-center justify-center bg-hud-bg text-hud-text">
      <p className="text-hud-muted">Loading simulator…</p>
    </main>
  );

  if (status === "error") return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4 safe-top safe-bottom bg-hud-bg text-hud-text">
      <p className="text-red-400 mb-4">Run not found or failed to load.</p>
      <button onClick={() => router.push("/")} className="text-hud-accent underline">Return Home</button>
    </main>
  );

  return (
    <main className="min-h-dvh flex flex-col bg-hud-bg text-hud-text safe-top safe-bottom safe-left safe-right overscroll-none">
      {/* SIMULATION banner */}
      <header className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/30 flex items-center justify-center">
        <span className="text-sm font-bold text-yellow-400">◆ SIMULATION</span>
        {run?.stubbed && <span className="ml-2 text-xs text-yellow-400/60">(stubbed)</span>}
      </header>

      {/* Title and speaker info */}
      <div className="px-4 py-3 border-b border-hud-border">
        <h1 className="text-lg font-bold">{scenario?.title || "Simulated Critique"}</h1>
        <p className="text-xs text-hud-muted mt-0.5">
          {scenario?.durationMinutes} min · {scenario?.speakerCount} speakers · {scenario?.turns?.length || 0} turns
        </p>
        {!audioReady && !audioLoading && status === "ready" && (
          <p className="text-xs text-yellow-400 mt-1">⚠ No audio available — visual playback only</p>
        )}
        {audioLoading && (
          <p className="text-xs text-hud-muted mt-1">Loading audio…</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2">
        <div className="flex justify-between text-xs text-hud-muted mb-1">
          <span>{formatTime(elapsed)}</span>
          <span>{formatTime(totalDurationMs)}</span>
        </div>
        <div className="h-2 bg-hud-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-hud-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {scenario?.speakers && (
          <div className="flex gap-1 mt-1">
            {scenario.speakers.map((spk, i) => (
              <div
                key={i}
                className="h-0.5 rounded-full transition-colors"
                style={{
                  width: `${100 / (scenario.speakers || []).length}%`,
                  backgroundColor: i === (currentTurn !== null && scenario.turns?.[currentTurn]?.speakerIndex)
                    ? "var(--hud-accent)" : "var(--hud-border)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Current turn display */}
      <div className="flex-1 flex items-center justify-center px-6 py-4">
        {currentTurn !== null && scenario?.turns?.[currentTurn] ? (
          <div className="text-center max-w-md">
            <p className="text-sm font-semibold text-hud-accent mb-3">
              {currentSpeaker || `Speaker ${scenario.turns[currentTurn].speakerIndex}`}
            </p>
            <p className="text-lg leading-relaxed">
              {scenario.turns[currentTurn].text}
            </p>
            <p className="text-xs text-hud-muted mt-4">
              Turn {currentTurn + 1} of {scenario.turns.length}
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-hud-muted text-lg mb-2">
              {status === "complete" ? "Playback Complete ✓" : status === "ready" ? "Ready to Play" : "Paused"}
            </p>
            {status === "ready" && audioReady && (
              <p className="text-xs text-green-400">Audio loaded ({((audioBufferRef.current?.duration || 0) / 60).toFixed(1)} min)</p>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t border-hud-border space-y-3">
        {/* Playback speed */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-hud-muted w-16">Speed</span>
          <div className="flex gap-1 flex-1">
            {[0.75, 1.0, 1.25, 1.5].map(speed => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                disabled={status === "playing"}
                className={`flex-1 py-1.5 rounded text-xs font-medium border transition-all touch-manipulation ${
                  playbackSpeed === speed
                    ? "bg-hud-accent/20 border-hud-accent text-hud-accent"
                    : "bg-hud-surface border-hud-border text-hud-muted"
                }`}
                style={{ minHeight: 36 }}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>

        {/* Main controls */}
        <div className="flex gap-3">
          {status === "ready" || status === "paused" ? (
            <button
              onClick={startPlayback}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95"
              style={{ minHeight: 56 }}
            >
              ▶ {status === "paused" ? "Resume" : "Start"}
            </button>
          ) : (
            <button
              onClick={pausePlayback}
              className="flex-1 py-3 bg-yellow-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95"
              style={{ minHeight: 56 }}
            >
              ⏸ Pause
            </button>
          )}
          <button
            onClick={stopPlayback}
            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95"
            style={{ minHeight: 56 }}
          >
            ⏹ Stop
          </button>
        </div>

        {/* Extra actions */}
        <div className="flex gap-2">
          {!audioReady && status === "ready" && (
            <button
              onClick={loadAudio}
              disabled={audioLoading}
              className="flex-1 py-2 bg-hud-surface border border-hud-border rounded-lg text-sm text-hud-text"
              style={{ minHeight: 44 }}
            >
              {audioLoading ? "Loading audio…" : "🔊 Load Audio"}
            </button>
          )}
          {mixedAudioUrl && (
            <a
              href={mixedAudioUrl}
              download
              className="flex-1 py-2 bg-hud-surface border border-hud-border rounded-lg text-sm text-hud-text text-center"
              style={{ minHeight: 44, lineHeight: "28px" }}
            >
              📥 Download WAV
            </a>
          )}
        </div>

        {supported && !locked && status === "playing" && (
          <p className="text-xs text-yellow-400 text-center">Screen may sleep — keep it awake manually</p>
        )}
      </div>
    </main>
  );
}
