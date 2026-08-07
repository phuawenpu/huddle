"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWakeLock } from "@/lib/client/wake-lock";

interface ScenarioData {
  id: string;
  title: string;
  speakers?: Array<{ index: number; name: string }>;
  turns?: Array<{ index: number; speakerIndex: number; text: string; startMs?: number; endMs?: number }>;
  durationMinutes: number;
  speakerCount: number;
  realizedDurationMs?: number;
}

export default function SimulatorPage() {
  const params = useParams<{ runId: string }>();
  const router = useRouter();
  const runId = params.runId;

  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [currentTurn, setCurrentTurn] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [error, setError] = useState("");
  const [wavUrl, setWavUrl] = useState<string | null>(null);
  const [wavSize, setWavSize] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentTurnIdxRef = useRef<number>(0);

  const { acquire } = useWakeLock();

  // Load run → get scenarioId → load scenario → set WAV URL
  useEffect(() => {
    (async () => {
      try {
        // Try loading the run to get its scenarioId
        let sid: string | null = null;
        const rRes = await fetch(`/api/runs/${runId}`);
        if (rRes.ok) {
          const r = await rRes.json();
          sid = r.scenarioId || null;
        }
        
        // If no run or no scenarioId, try using runId directly as scenarioId
        if (!sid) {
          const directCheck = await fetch(`/api/scenarios/${runId}`);
          if (directCheck.ok) {
            sid = runId;
          }
        }

        if (!sid) throw new Error("Could not find recording for this ID");

        setScenarioId(sid);

        // Load scenario data
        const sRes = await fetch(`/api/scenarios/${sid}`);
        if (!sRes.ok) throw new Error("Scenario not found");
        const sData = await sRes.json();
        setScenario(sData);

        // Audio existence is part of readiness. A database status alone is
        // not sufficient because an older volume or failed render can leave
        // the scenario metadata pointing at a file that does not exist.
        const url = `/api/scenarios/${sid}/mixed?format=wav`;
        const audioHead = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (!audioHead.ok) {
          const detail = await fetch(url, { cache: "no-store" })
            .then((response) => response.json())
            .then((body) => body?.error)
            .catch(() => null);
          throw new Error(
            detail ||
              "This scenario has no rendered audio. Return to the scenario and synthesize it before playback."
          );
        }
        setWavUrl(url);
        setWavSize(Number(audioHead.headers.get("content-length")) || null);

        setStatus("ready");
      } catch (e: any) {
        setError(e.message || "Failed to load");
        setStatus("error");
      }
    })();
  }, [runId]);

  // Playback
  const startPlayback = useCallback(async () => {
    if (!wavUrl) return;
    
    setError("");
    setStatus("playing");
    await acquire();

    // Create or reuse audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else {
      const audio = new Audio(wavUrl);
      audioRef.current = audio;
    }

    const audio = audioRef.current!;
    audio.playbackRate = playbackSpeed;

    // Progress tracking
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      if (!audio.paused && !audio.ended) {
        const currentMs = audio.currentTime * 1000;
        setElapsed(Math.round(currentMs));

        // Track current turn
        if (scenario?.turns) {
          for (let i = scenario.turns.length - 1; i >= 0; i--) {
            if (currentMs >= (scenario.turns[i].startMs || 0)) {
              if (i !== currentTurnIdxRef.current) {
                currentTurnIdxRef.current = i;
                setCurrentTurn(i);
              }
              break;
            }
          }
        }
      }
    }, 150);

    audio.onended = () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setStatus("complete");
      setElapsed(Math.round(audio.duration * 1000));
    };

    audio.onerror = () => {
      setError(`Audio playback error: ${audio.error?.message || "unknown"}`);
      setStatus("ready");
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };

    try {
      await audio.play();
    } catch (e: any) {
      setError(`Play failed: ${e.message}. Tap Start again.`);
      setStatus("ready");
    }
  }, [wavUrl, acquire, playbackSpeed, scenario]);

  const pausePlayback = useCallback(() => {
    audioRef.current?.pause();
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setStatus("paused");
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setStatus("ready");
    setElapsed(0);
    setCurrentTurn(null);
    currentTurnIdxRef.current = 0;
  }, []);

  // Update playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Cleanup
  useEffect(() => () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    audioRef.current?.pause();
  }, []);

  const speaker = scenario?.speakers && currentTurn !== null && scenario.turns
    ? scenario.speakers[scenario.turns[currentTurn]?.speakerIndex]?.name : null;

  const totalMs = scenario?.realizedDurationMs ||
    (scenario?.durationMinutes || 0) * 60000;
  const progress = totalMs > 0 ? Math.min(100, (elapsed / totalMs) * 100) : 0;

  const fmt = (ms: number) => {
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (status === "loading") return (
    <main className="min-h-dvh flex items-center justify-center bg-hud-bg text-hud-text">
      <p className="text-hud-muted">Loading simulator…</p>
    </main>
  );

  if (status === "error") return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 safe-top safe-bottom bg-hud-bg text-hud-text">
      <p className="text-red-400 mb-4">Failed to load</p>
      <p className="text-sm text-hud-muted mb-6">{error}</p>
      <button onClick={() => router.push("/scenarios")} className="px-6 py-3 bg-hud-accent rounded-xl text-white font-semibold">
        Browse Scenarios
      </button>
    </main>
  );

  return (
    <main className="min-h-dvh flex flex-col bg-hud-bg text-hud-text safe-top safe-bottom safe-left safe-right overscroll-none">
      {/* SIMULATION banner */}
      <header className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/30 flex items-center justify-center gap-2">
        <span className="text-sm font-bold text-yellow-400">◆ SIMULATION</span>
      </header>

      {/* Title + metadata */}
      <div className="px-4 py-3 border-b border-hud-border">
        <h1 className="text-lg font-bold">{scenario?.title || "Simulated Critique"}</h1>
        <p className="text-xs text-hud-muted mt-0.5">
          {scenario?.durationMinutes} min · {scenario?.speakerCount} speakers · {scenario?.turns?.length || 0} turns
          {wavSize && ` · ${(wavSize / 1024 / 1024).toFixed(1)} MB`}
          {status === "ready" && wavUrl && " · 🔊 Ready"}
        </p>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2">
        <div className="flex justify-between text-xs text-hud-muted mb-1">
          <span>{fmt(elapsed)}</span><span>{fmt(totalMs)}</span>
        </div>
        <div className="h-2 bg-hud-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-hud-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {(scenario?.speakers || []).length > 0 && (
          <div className="flex gap-1 mt-1">
            {(scenario?.speakers || []).slice(0, 6).map((spk, i) => (
              <div key={i} className="h-0.5 rounded-full transition-colors" style={{
                width: `${100 / (scenario?.speakers || []).length}%`,
                backgroundColor: i === (currentTurn !== null && scenario?.turns?.[currentTurn]?.speakerIndex)
                  ? "#60a5fa" : "#374151",
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Current turn */}
      <div className="flex-1 flex items-center justify-center px-6 py-4">
        {currentTurn !== null && scenario?.turns?.[currentTurn] ? (
          <div className="text-center max-w-md">
            <p className="text-sm font-semibold text-blue-400 mb-3">
              {speaker || `Speaker ${scenario.turns[currentTurn].speakerIndex}`}
            </p>
            <p className="text-lg leading-relaxed">{scenario.turns[currentTurn].text}</p>
            <p className="text-xs text-hud-muted mt-4">
              Turn {currentTurn + 1} of {scenario.turns.length}
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-hud-muted text-lg mb-2">
              {status === "complete" ? "✓ Complete" 
               : status === "playing" ? "▶ Playing…" 
               : status === "paused" ? "⏸ Paused"
               : "Ready"}
            </p>
            {error && (
              <p className="text-xs text-red-400 mt-1 max-w-sm mx-auto">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t border-hud-border space-y-3">
        {/* Speed selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-hud-muted w-16">Speed</span>
          <div className="flex gap-1 flex-1">
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(s => (
              <button key={s} onClick={() => setPlaybackSpeed(s)}
                className={`flex-1 py-1.5 rounded text-xs font-medium border touch-manipulation ${
                  playbackSpeed === s ? "bg-hud-accent/20 border-hud-accent text-hud-accent" : "bg-hud-surface border-hud-border text-hud-muted"
                }`} style={{ minHeight: 36 }}>{s}×</button>
            ))}
          </div>
        </div>

        {/* Play/Pause/Stop */}
        <div className="flex gap-3">
          {(status === "ready" || status === "complete") && (
            <button onClick={startPlayback} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95" style={{ minHeight: 56 }}>
              ▶ {status === "complete" ? "Replay" : "Start"}
            </button>
          )}
          {status === "paused" && (
            <button onClick={startPlayback} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95" style={{ minHeight: 56 }}>
              ▶ Resume
            </button>
          )}
          {status === "playing" && (
            <button onClick={pausePlayback} className="flex-1 py-3 bg-yellow-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95" style={{ minHeight: 56 }}>
              ⏸ Pause
            </button>
          )}
          <button onClick={stopPlayback} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold text-lg touch-manipulation active:scale-95" style={{ minHeight: 56 }}>
            ⏹ Stop
          </button>
        </div>

        {/* Download */}
        {wavUrl && (
          <a
            href={wavUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-3 bg-hud-surface border border-hud-border rounded-lg text-sm text-hud-text text-center touch-manipulation hover:bg-hud-accent/10"
            style={{ minHeight: 44, textDecoration: "none" }}
          >
            📥 Open WAV in new tab (right-click → Save As to download)
          </a>
        )}
      </div>
    </main>
  );
}
