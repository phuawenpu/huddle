"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWakeLock } from "@/lib/client/wake-lock";
import { AudioVisualizer } from "@/lib/client/audio-visualizer";

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
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null);
  const [debugMsg, setDebugMsg] = useState<string>("");

  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentTurnIdxRef = useRef<number>(0);

  const { locked, supported, acquire } = useWakeLock();

  // Load run and scenario
  useEffect(() => {
    (async () => {
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
            setMixedAudioUrl(`/api/scenarios/${runData.scenarioId}/mixed?format=wav`);
          }
        }
        setStatus("ready");
      } catch (e: any) {
        setStatus("error");
        setDebugMsg(e.message || "Failed to load");
      }
    })();
  }, [runId]);

  // START PLAYBACK — fresh AudioContext inside click handler
  const startPlayback = useCallback(async () => {
    setDebugMsg("");
    await fetch(`/api/runs/${runId}/playback`, { method: "POST" });
    await acquire();

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // Load audio if not cached
    if (!audioBufferRef.current && mixedAudioUrl) {
      try {
        const resp = await fetch(mixedAudioUrl);
        const buf = await resp.arrayBuffer();
        audioBufferRef.current = await ctx.decodeAudioData(buf);
      } catch (e: any) {
        setDebugMsg(`Load error: ${e.message} — visual only`);
        startVisualOnly(ctx);
        return;
      }
    }

    const buffer = audioBufferRef.current;
    if (!buffer) {
      startVisualOnly(ctx);
      return;
    }

    setDebugMsg(`Playing ${buffer.duration.toFixed(1)}s`);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackSpeed;
    source.connect(ctx.destination);
    sourceNodeRef.current = source;

    const totalMs = (buffer.duration / playbackSpeed) * 1000;
    startTimeRef.current = ctx.currentTime;
    setStatus("playing");

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      const elapsedMs = (ctx.currentTime - startTimeRef.current) * 1000 * playbackSpeed;
      setElapsed(Math.round(elapsedMs));
      if (scenario?.turns) {
        for (let i = scenario.turns.length - 1; i >= 0; i--) {
          if (elapsedMs >= (scenario.turns[i].startMs || 0)) {
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
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setStatus("complete");
      setElapsed(Math.round(totalMs));
      setDebugMsg("Complete ✓");
      sourceNodeRef.current = null;
    };

    source.start(0);
  }, [runId, acquire, playbackSpeed, scenario, mixedAudioUrl]);

  const startVisualOnly = useCallback(async (ctx: AudioContext) => {
    if (!scenario?.turns) return;
    setStatus("playing");
    await acquire();
    let turnIdx = 0;
    let cumulative = 0;
    currentTurnIdxRef.current = 0;
    const advance = () => {
      if (turnIdx >= scenario.turns!.length) { setStatus("complete"); return; }
      setCurrentTurn(turnIdx);
      currentTurnIdxRef.current = turnIdx;
      const dur = Math.max(1500, ((scenario.turns![turnIdx].endMs || 0) - (scenario.turns![turnIdx].startMs || 0)) / playbackSpeed);
      cumulative += dur;
      setElapsed(cumulative);
      turnIdx++;
      setTimeout(advance, dur);
    };
    advance();
    ctx.close().catch(() => {});
  }, [scenario, playbackSpeed, acquire]);

  const pausePlayback = useCallback(() => {
    if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch {} sourceNodeRef.current = null; }
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setStatus("paused");
  }, []);

  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch {} sourceNodeRef.current = null; }
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    audioBufferRef.current = null;
    setStatus("ready");
    setElapsed(0);
    setCurrentTurn(null);
    currentTurnIdxRef.current = 0;
    setDebugMsg("");
  }, []);

  useEffect(() => () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    sourceNodeRef.current?.stop?.();
    audioCtxRef.current?.close().catch(() => {});
  }, []);

  const speaker = scenario?.speakers && currentTurn !== null && scenario.turns
    ? scenario.speakers[scenario.turns[currentTurn]?.speakerIndex]?.name : null;

  const totalMs = (audioBufferRef.current?.duration || 0) * 1000 ||
    scenario?.realizedDurationMs || (scenario?.durationMinutes || 0) * 60000;
  const progress = totalMs > 0 ? Math.min(100, (elapsed / totalMs) * 100) : 0;

  const fmt = (ms: number) => {
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (status === "loading") return <main className="min-h-dvh flex items-center justify-center bg-hud-bg text-hud-text"><p className="text-hud-muted">Loading…</p></main>;
  if (status === "error") return <main className="min-h-dvh flex flex-col items-center justify-center p-4 safe-top safe-bottom bg-hud-bg text-hud-text"><p className="text-red-400 mb-4">Run not found.</p><p className="text-xs text-hud-muted mb-4">{debugMsg}</p><button onClick={() => router.push("/")} className="text-hud-accent underline">Home</button></main>;

  return (
    <main className="min-h-dvh flex flex-col bg-hud-bg text-hud-text safe-top safe-bottom safe-left safe-right overscroll-none">
      <header className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/30 flex items-center justify-center">
        <span className="text-sm font-bold text-yellow-400">◆ SIMULATION</span>
        {run?.stubbed && <span className="ml-2 text-xs text-yellow-400/60">(stubbed)</span>}
      </header>

      <div className="px-4 py-3 border-b border-hud-border">
        <h1 className="text-lg font-bold">{scenario?.title || "Simulated Critique"}</h1>
        <p className="text-xs text-hud-muted mt-0.5">
          {scenario?.durationMinutes}min · {scenario?.speakerCount} speakers · {scenario?.turns?.length || 0} turns
        </p>
        {audioBufferRef.current && <p className="text-xs text-green-400 mt-0.5">🔊 {(audioBufferRef.current.duration / 60).toFixed(1)} min loaded</p>}
      </div>

      {/* SPECTRUM VISUALIZER */}
      <div className="px-2 py-2">
        <AudioVisualizer
          source={status === "playing" ? sourceNodeRef.current : null}
          context={audioCtxRef.current}
          active={status === "playing"}
          bars={48}
          height={72}
          className="rounded-lg"
        />
      </div>

      {/* Progress */}
      <div className="px-4 py-2">
        <div className="flex justify-between text-xs text-hud-muted mb-1">
          <span>{fmt(elapsed)}</span><span>{fmt(totalMs)}</span>
        </div>
        <div className="h-2 bg-hud-surface rounded-full overflow-hidden">
          <div className="h-full bg-hud-accent transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        {(scenario?.speakers || []).length > 0 && (
          <div className="flex gap-1 mt-1">
            {(scenario?.speakers || []).slice(0, 6).map((spk, i) => (
              <div key={i} className="h-0.5 rounded-full transition-colors" style={{
                width: `${100 / (scenario?.speakers || []).length}%`,
                backgroundColor: i === (currentTurn !== null && scenario?.turns?.[currentTurn]?.speakerIndex) ? "var(--hud-accent,#60a5fa)" : "var(--hud-border,#374151)",
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Current turn */}
      <div className="flex-1 flex items-center justify-center px-6 py-4">
        {currentTurn !== null && scenario?.turns?.[currentTurn] ? (
          <div className="text-center max-w-md">
            <p className="text-sm font-semibold text-hud-accent mb-3">{speaker || `Speaker ${scenario.turns[currentTurn].speakerIndex}`}</p>
            <p className="text-lg leading-relaxed">{scenario.turns[currentTurn].text}</p>
            <p className="text-xs text-hud-muted mt-4">Turn {currentTurn + 1} of {scenario.turns.length}</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-hud-muted text-lg mb-2">
              {status === "complete" ? "✓ Complete" : status === "playing" ? "▶ Playing…" : status === "paused" ? "⏸ Paused" : "Ready"}
            </p>
            {debugMsg && <p className="text-xs text-hud-muted mt-1 max-w-xs mx-auto break-words">{debugMsg}</p>}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t border-hud-border space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-hud-muted w-16">Speed</span>
          <div className="flex gap-1 flex-1">
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(s => (
              <button key={s} onClick={() => setPlaybackSpeed(s)} disabled={status === "playing"}
                className={`flex-1 py-1.5 rounded text-xs font-medium border touch-manipulation ${playbackSpeed === s ? "bg-hud-accent/20 border-hud-accent text-hud-accent" : "bg-hud-surface border-hud-border text-hud-muted"}`}
                style={{ minHeight: 36 }}>{s}×</button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          {(status === "ready" || status === "complete") && (
            <button onClick={startPlayback} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95" style={{ minHeight: 56 }}>
              ▶ {status === "complete" ? "Replay" : "Start"}
            </button>
          )}
          {status === "paused" && (
            <button onClick={startPlayback} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95" style={{ minHeight: 56 }}>▶ Resume</button>
          )}
          {status === "playing" && (
            <button onClick={pausePlayback} className="flex-1 py-3 bg-yellow-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95" style={{ minHeight: 56 }}>⏸ Pause</button>
          )}
          <button onClick={stopPlayback} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95" style={{ minHeight: 56 }}>⏹ Stop</button>
        </div>

        {mixedAudioUrl && (
          <a href={mixedAudioUrl} download className="block py-2.5 bg-hud-surface border border-hud-border rounded-lg text-sm text-hud-text text-center touch-manipulation" style={{ minHeight: 44, lineHeight: "24px" }}>
            📥 Download WAV
          </a>
        )}

        {supported && !locked && status === "playing" && (
          <p className="text-xs text-yellow-400 text-center">Screen may sleep — keep awake manually</p>
        )}
      </div>
    </main>
  );
}
