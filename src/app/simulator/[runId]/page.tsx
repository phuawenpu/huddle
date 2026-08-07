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
  const [debugMsg, setDebugMsg] = useState<string>("");

  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentTurnIdxRef = useRef<number>(0);

  const { locked, supported, acquire } = useWakeLock();

  // Load run and scenario data
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
            setMixedAudioUrl(`/api/scenarios/${runData.scenarioId}/mixed?format=wav`);
          }
        }
        setStatus("ready");
      } catch (e: any) {
        setStatus("error");
        setDebugMsg(e.message || "Failed to load");
      }
    };
    load();
  }, [runId]);

  // ---- AUDIO LOAD: triggered by user clicking "Load Audio" ----
  const loadAudio = useCallback(async () => {
    if (!mixedAudioUrl) {
      setDebugMsg("No audio URL available");
      return;
    }
    
    setAudioLoading(true);
    setDebugMsg(`Loading: ${mixedAudioUrl}...`);
    
    try {
      // Fetch the WAV file
      const response = await fetch(mixedAudioUrl);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type") || "";
      setDebugMsg(`Got ${response.headers.get("content-length") || "?"} bytes, type=${contentType}`);
      
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength < 100) {
        throw new Error(`File too small: ${arrayBuffer.byteLength} bytes`);
      }
      
      setDebugMsg(`Loaded ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB. Decoding audio...`);

      // Create a fresh AudioContext (must be inside user gesture on iOS)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      
      // Resume immediately (we're in a click handler)
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      
      setDebugMsg(`AudioContext state: ${ctx.state}, sampleRate: ${ctx.sampleRate}Hz`);

      // Decode
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBufferRef.current = audioBuffer;
      
      setDebugMsg(`Decoded: ${audioBuffer.duration.toFixed(1)}s, ${audioBuffer.numberOfChannels}ch, ${audioBuffer.sampleRate}Hz`);
      setAudioReady(true);
      setAudioLoading(false);
    } catch (err: any) {
      setDebugMsg(`Error: ${err.message}`);
      setAudioLoading(false);
      setAudioReady(false);
    }
  }, [mixedAudioUrl]);

  // ---- START PLAYBACK ----
  const startPlayback = useCallback(async () => {
    setDebugMsg("");
    
    await fetch(`/api/runs/${runId}/playback`, { method: "POST" });
    await acquire();

    // Create fresh AudioContext inside user gesture
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    
    // Resume
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    
    if (!audioBufferRef.current) {
      // Need to load audio first
      if (!mixedAudioUrl) {
        setDebugMsg("No audio source — starting visual-only playback");
        startVisualPlayback(ctx);
        return;
      }
      
      try {
        const resp = await fetch(mixedAudioUrl);
        const buf = await resp.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(buf);
        audioBufferRef.current = audioBuf;
        setAudioReady(true);
      } catch (e: any) {
        setDebugMsg(`Load failed: ${e.message} — visual playback`);
        startVisualPlayback(ctx);
        return;
      }
    }

    const audioBuffer = audioBufferRef.current;
    if (!audioBuffer) {
      startVisualPlayback(ctx);
      return;
    }

    setDebugMsg(`Playing: ${audioBuffer.duration.toFixed(1)}s, ${audioBuffer.numberOfChannels}ch, ${audioBuffer.sampleRate}Hz`);

    // Create source node
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = playbackSpeed;
    source.connect(ctx.destination);
    sourceNodeRef.current = source;

    const totalDuration = audioBuffer.duration / playbackSpeed;
    startTimeRef.current = ctx.currentTime;
    setStatus("playing");

    // Progress tracking
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      const elapsedMs = (ctx.currentTime - startTimeRef.current) * 1000 * playbackSpeed;
      setElapsed(Math.round(elapsedMs));

      // Track current turn
      if (scenario?.turns) {
        for (let i = scenario.turns.length - 1; i >= 0; i--) {
          const turn = scenario.turns[i];
          if (elapsedMs >= (turn.startMs || 0)) {
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
      setElapsed(Math.round(totalDuration * 1000));
      setDebugMsg("Playback complete ✓");
    };

    source.start(0);
  }, [runId, acquire, playbackSpeed, scenario, mixedAudioUrl, audioReady]);

  // Visual-only fallback
  const startVisualPlayback = useCallback(async (ctx: AudioContext) => {
    if (!scenario?.turns) return;
    
    setStatus("playing");
    await acquire();

    let turnIdx = 0;
    currentTurnIdxRef.current = 0;
    let cumulativeMs = 0;
    
    const advanceTurn = () => {
      if (turnIdx >= scenario.turns!.length) {
        setStatus("complete");
        return;
      }
      setCurrentTurn(turnIdx);
      currentTurnIdxRef.current = turnIdx;
      
      const turn = scenario.turns![turnIdx];
      const durationMs = Math.max(1500, ((turn.endMs || 0) - (turn.startMs || 0)) / playbackSpeed);
      cumulativeMs += durationMs;
      setElapsed(cumulativeMs);
      turnIdx++;
      
      setTimeout(advanceTurn, durationMs);
    };
    
    advanceTurn();
    ctx.close().catch(() => {});
  }, [scenario, playbackSpeed, acquire]);

  // Pause
  const pausePlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setStatus("paused");
  }, []);

  // Stop
  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setStatus("ready");
    setElapsed(0);
    setCurrentTurn(null);
    currentTurnIdxRef.current = 0;
    setAudioReady(false);
    audioBufferRef.current = null;
    setDebugMsg("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch {}
      }
    };
  }, []);

  const currentSpeaker = scenario?.speakers && currentTurn !== null && scenario.turns
    ? scenario.speakers[scenario.turns[currentTurn]?.speakerIndex]?.name
    : null;

  const totalDurationMs = (audioBufferRef.current?.duration || 0) * 1000 || 
    scenario?.realizedDurationMs || (scenario?.durationMinutes || 0) * 60000;
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
      <p className="text-xs text-hud-muted mb-4">{debugMsg}</p>
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

      {/* Title */}
      <div className="px-4 py-3 border-b border-hud-border">
        <h1 className="text-lg font-bold">{scenario?.title || "Simulated Critique"}</h1>
        <p className="text-xs text-hud-muted mt-0.5">
          {scenario?.durationMinutes} min · {scenario?.speakerCount} speakers · {scenario?.turns?.length || 0} turns
        </p>
        {audioReady && audioBufferRef.current && (
          <p className="text-xs text-green-400 mt-0.5">
            🔊 Audio ready ({audioBufferRef.current.duration.toFixed(1)}s)
          </p>
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
            {(scenario.speakers || []).slice(0, 6).map((spk, i) => (
              <div
                key={i}
                className="h-0.5 rounded-full transition-colors"
                style={{
                  width: `${100 / (scenario.speakers || []).length}%`,
                  backgroundColor: i === (currentTurn !== null && scenario.turns?.[currentTurn]?.speakerIndex)
                    ? "var(--hud-accent, #60a5fa)" : "var(--hud-border, #374151)",
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
              {status === "complete" ? "Playback Complete ✓" 
               : status === "playing" ? "▶ Playing…" 
               : status === "paused" ? "⏸ Paused"
               : "Ready to Play"}
            </p>
            {debugMsg && (
              <p className="text-xs text-hud-muted mt-1 max-w-xs mx-auto break-words">{debugMsg}</p>
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
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(speed => (
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
          {(status === "ready" || status === "complete") && (
            <button
              onClick={startPlayback}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95"
              style={{ minHeight: 56 }}
            >
              ▶ {status === "complete" ? "Replay" : "Start"}
            </button>
          )}
          {status === "paused" && (
            <button
              onClick={startPlayback}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95"
              style={{ minHeight: 56 }}
            >
              ▶ Resume
            </button>
          )}
          {status === "playing" && (
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
          <button
            onClick={loadAudio}
            disabled={audioLoading}
            className="flex-1 py-2.5 bg-hud-surface border border-hud-border rounded-lg text-sm text-hud-text touch-manipulation"
            style={{ minHeight: 44 }}
          >
            {audioLoading ? "Loading…" : audioReady ? "🔊 Reload Audio" : "🎵 Test Load Audio"}
          </button>
          {mixedAudioUrl && (
            <a
              href={mixedAudioUrl}
              download
              className="flex-1 py-2.5 bg-hud-surface border border-hud-border rounded-lg text-sm text-hud-text text-center touch-manipulation"
              style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
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
