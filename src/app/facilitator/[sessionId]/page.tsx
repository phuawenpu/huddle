"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAudioCapture } from "@/lib/client/audio-capture";
import {
  createASRClient,
  type ASRClient,
  type IngestTurnData,
} from "@/lib/client/asr-client";
import { useWakeLock } from "@/lib/client/wake-lock";
import { AudioVisualizer } from "@/lib/client/audio-visualizer";
import type {
  CritiqueIntelligenceSnapshot,
  LiveAnalysisSnapshot,
  VisualEvidenceData,
} from "@/lib/types";
import { LiveAnalysisHud } from "./live-analysis-hud";
import { VisualEvidenceCapture } from "./visual-evidence-capture";

interface SessionData {
  id: string;
  title: string;
  objective: string;
  phase: string;
  criteria: string[];
  speakerCount: number;
  status: string;
  runMode: string;
  scenarioId?: string | null;
  sourceAudioUrl?: string | null;
}

interface TranscriptTurn {
  id: string;
  providerSessionId: string;
  providerTurnOrder: number;
  providerSpeakerLabel: string;
  originalProviderSpeakerLabel: string;
  participantName?: string;
  originalText: string;
  currentText: string;
  startMs: number;
  endMs: number;
  isFinal: boolean;
  isSubstantive: boolean;
  isCalibration: boolean;
  isUnknownSpeaker: boolean;
  possibleOverlap: boolean;
  isManuallyCorrected?: boolean;
  wasSpeakerRevised?: boolean;
  analysis?: any;
  wordsJson?: any[];
}

interface SpeakerMapping {
  id: string;
  speakerLabel: string;
  participantId?: string;
}

interface Participant {
  id: string;
  displayName: string;
}

export default function FacilitatorPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<SessionData | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [mappings, setMappings] = useState<SpeakerMapping[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState("");
  const [streamingMins, setStreamingMins] = useState(0);
  const [asrConnected, setAsrConnected] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [livePartial, setLivePartial] = useState<string>("");
  const [starting, setStarting] = useState(false);
  const [pcmReady, setPcmReady] = useState(false);
  const [intelligence, setIntelligence] =
    useState<CritiqueIntelligenceSnapshot | null>(null);
  const [liveAnalysis, setLiveAnalysis] = useState<LiveAnalysisSnapshot | null>(
    null,
  );
  const [visualEvidence, setVisualEvidence] = useState<VisualEvidenceData[]>(
    [],
  );
  const [analyzing, setAnalyzing] = useState(false);

  const [intentObjective, setIntentObjective] = useState("");
  const [intentPhase, setIntentPhase] = useState("");
  const [intentCriteria, setIntentCriteria] = useState("");

  const asrRef = useRef<ASRClient | null>(null);
  const streamingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pcm16CountRef = useRef(0);
  const pendingPcmRef = useRef<ArrayBuffer[]>([]);
  const recordingEndedHandlerRef = useRef<() => void>(() => {});
  const transcriptViewportRef = useRef<HTMLDivElement | null>(null);
  const previousFinalTurnCountRef = useRef(0);
  const [followTranscript, setFollowTranscript] = useState(true);
  const [unseenTurnCount, setUnseenTurnCount] = useState(0);

  // Audio capture hook
  const {
    start: startCapture,
    startRecording,
    stop: stopCapture,
    isCapturing,
    sourceKind,
    settings,
    meter,
    error: captureError,
    workletLoaded,
    analyserNode,
  } = useAudioCapture({
    onPcm16: (buffer: ArrayBuffer, frameIndex: number) => {
      if (pcm16CountRef.current === 0) setPcmReady(true);
      if (asrRef.current) {
        asrRef.current.sendAudio(buffer);
      } else if (pendingPcmRef.current.length < 100) {
        // Preserve up to five seconds while token/WebSocket setup completes.
        pendingPcmRef.current.push(buffer);
      }
      pcm16CountRef.current++;
    },
    onSettingsReadback: (s) => {
      console.log("Audio settings:", s);
    },
    onError: (err) => {
      setError(`Audio capture error: ${err.message}`);
    },
    onSourceEnded: () => recordingEndedHandlerRef.current(),
  });

  // Wake lock
  const {
    locked: wakeLocked,
    supported: wakeLockSupported,
    acquire: acquireWakeLock,
    release: releaseWakeLock,
  } = useWakeLock();

  // Load session data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        if (!res.ok) throw new Error("Session not found");
        const data = await res.json();
        setSession(data);
        setIntentObjective(data.objective || "");
        setIntentPhase(data.phase || "");
        setIntentCriteria((data.criteria || []).join("\n"));

        // Load turns, mappings, participants
        const [tRes, mRes, pRes, aRes, vRes] = await Promise.all([
          fetch(`/api/sessions/${sessionId}/turns`),
          fetch(`/api/sessions/${sessionId}/speaker-mappings`),
          fetch(`/api/sessions/${sessionId}/participants`),
          fetch(`/api/sessions/${sessionId}/analyses?limit=1`),
          fetch(`/api/sessions/${sessionId}/visual-evidence`),
        ]);
        if (tRes.ok) setTurns(await tRes.json());
        if (mRes.ok) setMappings(await mRes.json());
        if (pRes.ok) setParticipants(await pRes.json());
        if (aRes.ok) {
          const analyses = await aRes.json();
          setLiveAnalysis((current) =>
            newestAnalysis(current, analyses[0] || null),
          );
        }
        if (vRes.ok) {
          const evidence = await vRes.json();
          setVisualEvidence((current) =>
            mergeVisualEvidence(current, evidence),
          );
        }
      } catch (e: any) {
        setError(e.message || "Failed to load session");
      }
    };
    load();
  }, [sessionId]);

  // SSE event listener for live patches
  useEffect(() => {
    const es = new EventSource(`/api/sessions/${sessionId}/events`);
    let lastId = "";

    es.addEventListener("snapshot", (e) => {
      lastId = e.lastEventId;
      try {
        const data = JSON.parse(e.data);
        if (data.turns) setTurns(data.turns);
        if (data.session) {
          setSession((current) => {
            if (!current) return data.session;
            const preserveTerminalOrActiveState =
              (current.status === "active" ||
                current.status === "terminated") &&
              data.session.status === "setup";
            return {
              ...current,
              ...data.session,
              scenarioId: data.session.scenarioId ?? current.scenarioId,
              sourceAudioUrl:
                data.session.sourceAudioUrl ?? current.sourceAudioUrl,
              status: preserveTerminalOrActiveState
                ? current.status
                : data.session.status,
            };
          });
        }
        if (data.speakerMappings) setMappings(data.speakerMappings);
        if (data.participants) setParticipants(data.participants);
        if (data.intelligence) setIntelligence(data.intelligence);
        if (data.liveAnalysis !== undefined) {
          setLiveAnalysis((current) =>
            newestAnalysis(current, data.liveAnalysis),
          );
        }
        if (data.visualEvidence) {
          setVisualEvidence((current) =>
            mergeVisualEvidence(current, data.visualEvidence),
          );
        }
      } catch {}
    });

    es.addEventListener("turn.final", (e) => {
      lastId = e.lastEventId;
      try {
        const turn = JSON.parse(e.data);
        setTurns((prev) => {
          const idx = prev.findIndex((t) => t.id === turn.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = turn;
            return next;
          }
          return [...prev, turn];
        });
        setLivePartial("");
        setActiveSpeaker(null);
      } catch {}
    });

    es.addEventListener("turn.updated", (e) => {
      try {
        const turn = JSON.parse(e.data);
        setTurns((prev) => prev.map((t) => (t.id === turn.id ? turn : t)));
      } catch {}
    });

    es.addEventListener("status", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status === "terminated") {
          setSession((s) => (s ? { ...s, status: "terminated" } : s));
        }
      } catch {}
    });

    es.addEventListener("metrics", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.streamingMinutesUsed !== undefined) {
          setStreamingMins(data.streamingMinutesUsed);
        }
      } catch {}
    });

    es.addEventListener("intelligence", (e) => {
      try {
        setIntelligence(JSON.parse(e.data));
      } catch {}
    });

    es.addEventListener("live.analysis", (e) => {
      try {
        const analysis = JSON.parse(e.data) as LiveAnalysisSnapshot;
        setLiveAnalysis((current) => newestAnalysis(current, analysis));
      } catch {}
    });

    es.addEventListener("visual.evidence", (e) => {
      try {
        const evidence = JSON.parse(e.data) as VisualEvidenceData;
        setVisualEvidence((current) => [
          evidence,
          ...current.filter((item) => item.id !== evidence.id),
        ]);
      } catch {}
    });

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => es.close();
  }, [sessionId]);

  // Streaming minutes counter
  useEffect(() => {
    if (isCapturing) {
      streamingTimerRef.current = setInterval(() => {
        setStreamingMins((prev) => {
          const newVal = prev + 5 / 60;
          return Math.round(newVal * 10) / 10;
        });
      }, 5000);
    } else {
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current);
        streamingTimerRef.current = null;
      }
    }
    return () => {
      if (streamingTimerRef.current) clearInterval(streamingTimerRef.current);
    };
  }, [isCapturing]);

  // sendBeacon on unload
  useEffect(() => {
    const handler = () => {
      const sessionId = asrRef.current?.getState().sessionId;
      if (sessionId) {
        const body = JSON.stringify({ type: "Terminate", sessionId });
        navigator.sendBeacon("/api/sessions/terminate-beacon", body);
      }
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, []);

  // Ingest finalized turns to server
  const ingestTurn = useCallback(
    async (turnData: IngestTurnData) => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/turns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(turnData),
        });
        if (!res.ok) {
          console.error("Turn ingest failed:", await res.text());
          return;
        }
        const saved = await res.json();
        setTurns((current) => {
          const existing = current.findIndex((turn) => turn.id === saved.id);
          if (existing < 0) return [...current, saved];
          const next = [...current];
          next[existing] = saved;
          return next;
        });
      } catch (err) {
        console.error("Turn ingest error:", err);
      }
    },
    [sessionId],
  );

  // Start session
  const handleStart = async () => {
    if (starting || isCapturing) return;
    if (!session) {
      setError("Session details are still loading. Please try again.");
      return;
    }
    setStarting(true);
    setError("");
    pendingPcmRef.current = [];
    pcm16CountRef.current = 0;
    setPcmReady(false);
    try {
      // Ask for microphone permission immediately from the click gesture.
      // PCM frames wait briefly in pendingPcmRef while ASR connects.
      if (session?.runMode === "live") {
        await startCapture();
      }

      // Get ASR token
      const tokenRes = await fetch(
        `/api/providers/assemblyai/token?max_speakers=${Math.max(2, session?.speakerCount || 2)}`,
      );
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        throw new Error(
          tokenData.error || "Could not obtain an ASR session token.",
        );
      }

      // Create ASR client
      const asr = createASRClient({
        wsUrl:
          tokenData.wsUrl ||
          `${tokenData.wsBase}/v3/ws?sample_rate=16000&speech_model=u3-rt-pro&format_turns=true&speaker_labels=true&max_speakers=${Math.max(2, session?.speakerCount || 2)}&token=${encodeURIComponent(tokenData.token)}`,
        onTurn: (turn) => {
          if (turn.endOfTurn) {
            setActiveSpeaker(null);
            setLivePartial("");
          } else {
            setActiveSpeaker(turn.speakerLabel || null);
            setLivePartial(turn.transcript);
          }
        },
        onSpeechStarted: (event) => {
          setActiveSpeaker(event.speakerLabel || null);
        },
        onSpeakerRevision: (revision) => {
          // Apply revisions to existing turns
          for (const rev of revision.revisions) {
            setTurns((prev) =>
              prev.map((t) => {
                if (
                  t.providerSessionId === asr.getState().sessionId &&
                  t.providerTurnOrder === rev.turnOrder
                ) {
                  return {
                    ...t,
                    providerSpeakerLabel: rev.speakerLabel,
                    wasSpeakerRevised: true,
                  };
                }
                return t;
              }),
            );
          }
        },
        onTermination: () => {
          setAsrConnected(false);
          stopCapture();
          setPcmReady(false);
          releaseWakeLock();
          asrRef.current = null;
          void fetch(`/api/sessions/${sessionId}/terminate`, {
            method: "POST",
          });
          setSession((current) =>
            current ? { ...current, status: "terminated" } : current,
          );
        },
        onError: (err) => {
          setError(`ASR error: ${err.message}`);
        },
        onConnectionChange: (connected) => {
          setAsrConnected(connected);
        },
        onTurnIngest: ingestTurn,
      });

      asrRef.current = asr;

      // Connect ASR
      await asr.connect();

      for (const frame of pendingPcmRef.current) asr.sendAudio(frame);
      pendingPcmRef.current = [];

      const startResponse = await fetch(`/api/sessions/${sessionId}/start`, {
        method: "POST",
      });
      if (!startResponse.ok) {
        const detail = await startResponse.json().catch(() => null);
        throw new Error(detail?.error || "Could not start the session.");
      }

      if (session?.runMode !== "live") {
        if (!session?.scenarioId) {
          throw new Error(
            "This recorded session has no scenario audio source.",
          );
        }
        await startRecording(
          session.sourceAudioUrl ||
            `/api/scenarios/${session.scenarioId}/mixed?format=wav`,
        );
      }
      await acquireWakeLock();

      setSession((s) => (s ? { ...s, status: "active" } : s));
    } catch (e: any) {
      setError(e.message || "Failed to start session");
      asrRef.current?.disconnect();
      asrRef.current = null;
      stopCapture();
      setPcmReady(false);
      pendingPcmRef.current = [];
      releaseWakeLock();
    } finally {
      setStarting(false);
    }
  };

  // Stop session
  const handleStop = async () => {
    asrRef.current?.terminate();
    asrRef.current = null;
    stopCapture();
    setPcmReady(false);
    pendingPcmRef.current = [];
    releaseWakeLock();

    try {
      await fetch(`/api/sessions/${sessionId}/terminate`, { method: "POST" });
    } catch {}

    setSession((s) => (s ? { ...s, status: "terminated" } : s));
  };

  recordingEndedHandlerRef.current = () => {
    if (session?.status === "active") void handleStop();
  };

  // Snapshot the complete transcript through the current finalized turn under
  // the facilitator's current intent. Audio capture continues independently.
  const handleRunAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setError("");
    try {
      const criteria = intentCriteria
        .split("\n")
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0);

      const response = await fetch(`/api/sessions/${sessionId}/analyses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: intentObjective,
          phase: intentPhase,
          criteria,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to analyze the transcript");
      }
      setLiveAnalysis(result);
      setSession((s) =>
        s
          ? { ...s, objective: intentObjective, phase: intentPhase, criteria }
          : s,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to analyze the transcript",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // Map speaker label
  const mapSpeaker = async (label: string, participantId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/speaker-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakerLabel: label,
          participantId: participantId || null,
        }),
      });
      if (res.ok) {
        const mapping = await res.json();
        setMappings((prev) => [
          ...prev.filter((m) => m.speakerLabel !== label),
          mapping,
        ]);
      }
    } catch {}
  };

  // Correct turn text
  const correctTurn = async (turnId: string, newText: string) => {
    try {
      await fetch(`/api/turns/${turnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentText: newText }),
      });
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? { ...t, currentText: newText, isManuallyCorrected: true }
            : t,
        ),
      );
    } catch {}
  };

  const finalizedTurns = turns.filter((t) => t.isFinal);

  const scrollTranscriptToLatest = useCallback((behavior: ScrollBehavior) => {
    const viewport = transcriptViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    setFollowTranscript(true);
    setUnseenTurnCount(0);
  }, []);

  const handleTranscriptScroll = useCallback(() => {
    const viewport = transcriptViewportRef.current;
    if (!viewport) return;
    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const isAtLatest = distanceFromBottom <= 48;
    setFollowTranscript(isAtLatest);
    if (isAtLatest) setUnseenTurnCount(0);
  }, []);

  useEffect(() => {
    const previousCount = previousFinalTurnCountRef.current;
    const addedCount = Math.max(0, finalizedTurns.length - previousCount);
    previousFinalTurnCountRef.current = finalizedTurns.length;
    if (addedCount === 0) return;

    if (followTranscript) {
      const frame = requestAnimationFrame(() =>
        scrollTranscriptToLatest(previousCount === 0 ? "auto" : "smooth"),
      );
      return () => cancelAnimationFrame(frame);
    }

    setUnseenTurnCount((count) => count + addedCount);
  }, [finalizedTurns.length, followTranscript, scrollTranscriptToLatest]);

  const getParticipantName = (label: string) => {
    const mapping = mappings.find((m) => m.speakerLabel === label);
    if (mapping?.participantId) {
      const p = participants.find((p) => p.id === mapping.participantId);
      return p?.displayName || label;
    }
    return label;
  };

  const isActive = session?.status === "active";

  if (error && !session) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4 safe-top safe-bottom">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="text-hud-accent underline"
          >
            Return Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-dvh max-h-dvh overflow-hidden flex flex-col bg-hud-bg text-hud-text safe-top safe-bottom safe-left safe-right">
      {/* Header */}
      <header className="shrink-0 px-4 py-3 border-b border-hud-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">
            {session?.title || "Loading..."}
          </h1>
          <div className="flex gap-2 items-center text-sm text-hud-muted">
            <span
              className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400 animate-pulse" : "bg-gray-500"}`}
            />
            <span>{session?.status || "..."}</span>
            {isActive && wakeLockSupported && (
              <span
                className={wakeLocked ? "text-green-400" : "text-yellow-400"}
              >
                {wakeLocked ? "🔒" : "⚠️"}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="text-hud-muted">{streamingMins.toFixed(1)} min</span>
          {workletLoaded && <span className="text-green-400">Worklet ✓</span>}
          {pcmReady && <span className="text-green-400">PCM ✓</span>}
          {asrConnected && <span className="text-green-400">ASR ✓</span>}
          {sourceKind === "recording" && (
            <span className="text-hud-accent">Recorded demo</span>
          )}
        </div>
      </header>

      {/* Controls */}
      <div className="shrink-0 flex items-center gap-3 border-b border-hud-border bg-hud-surface/50 px-4 py-2">
        <div className="relative h-10 min-w-0 flex-1 overflow-hidden rounded-lg border border-cyan-300/10 bg-black/30">
          <AudioVisualizer
            analyser={analyserNode}
            bars={56}
            height={40}
            active={isActive}
            color="#22d3ee"
            className="opacity-80"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-white/5">
            <div
              className="h-full bg-cyan-300 transition-[width] duration-100"
              style={{ width: `${Math.min(100, meter * 100)}%` }}
            />
          </div>
        </div>

        {isActive ? (
          <button
            onClick={handleStop}
            className="px-6 py-3 bg-red-600 text-white rounded-xl font-semibold touch-manipulation active:scale-95"
            style={{ minHeight: 44 }}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={!session || session.status === "terminated" || starting}
            className="px-6 py-3 bg-hud-accent text-white rounded-xl font-semibold touch-manipulation active:scale-95 disabled:opacity-50"
            style={{ minHeight: 44 }}
          >
            {!session
              ? "Loading…"
              : session.status === "terminated"
                ? "Ended"
                : starting
                  ? "Starting…"
                  : session?.runMode === "live"
                    ? "Start Mic"
                    : "Start Recorded Demo"}
          </button>
        )}
      </div>

      {/* Live partial */}
      {isActive && livePartial && (
        <div className="px-4 py-2 bg-hud-surface border-b border-hud-border">
          <span className="text-xs text-hud-muted">
            {activeSpeaker ? getParticipantName(activeSpeaker) : "Speaker"}
          </span>
          <p className="text-sm italic text-hud-muted">{livePartial}</p>
        </div>
      )}

      <LiveAnalysisHud
        analysis={liveAnalysis}
        intelligence={intelligence}
        turns={finalizedTurns}
        objective={intentObjective}
        phase={intentPhase}
        criteriaText={intentCriteria}
        analyzing={analyzing}
        ready={Boolean(session)}
        onObjectiveChange={setIntentObjective}
        onPhaseChange={setIntentPhase}
        onCriteriaChange={setIntentCriteria}
        onAnalyze={handleRunAnalysis}
      />

      {/* Error display */}
      {(error || captureError) && (
        <div className="mx-4 mt-2 p-2 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
          {error || captureError}
        </div>
      )}

      {/* Audio settings readback */}
      {settings && (
        <div className="px-4 py-1 text-xs text-hud-muted">
          Mic: {settings.sampleRate}Hz · {settings.channelCount}ch
          {settings.echoCancellation && " · echo cancel"}
          {settings.noiseSuppression && " · noise supp"}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* Transcript */}
          <section
            className="relative min-h-0 min-w-0"
            aria-label="Live transcript"
          >
            <div
              ref={transcriptViewportRef}
              data-testid="transcript-scroll"
              data-following={followTranscript ? "true" : "false"}
              onScroll={handleTranscriptScroll}
              className="h-full overflow-y-scroll px-4 py-2 space-y-2 overscroll-contain touch-pan-y [scrollbar-gutter:stable]"
            >
              {finalizedTurns.length === 0 && !isActive && (
                <p className="text-hud-muted text-sm py-8 text-center">
                  {session?.status === "terminated"
                    ? "Session ended. No turns recorded."
                    : "Start capture to begin transcription."}
                </p>
              )}
              {finalizedTurns.length === 0 && isActive && (
                <p className="text-hud-muted text-sm py-8 text-center">
                  Listening… speak to begin.
                </p>
              )}

              {finalizedTurns.map((turn) => (
                <div
                  key={turn.id}
                  className={`p-3 rounded-lg border ${
                    turn.isSubstantive
                      ? "border-hud-border bg-hud-surface"
                      : "border-hud-border/50 bg-hud-surface/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-hud-accent/20 text-hud-accent">
                      {turn.isUnknownSpeaker
                        ? "Unassigned"
                        : getParticipantName(turn.providerSpeakerLabel)}
                    </span>
                    <span className="text-xs text-hud-muted">
                      {turn.isSubstantive ? "substantive" : "backchannel"}
                      {turn.isCalibration && " · calibration"}
                      {turn.possibleOverlap && " · overlap"}
                      {turn.isManuallyCorrected && " · corrected"}
                      {turn.wasSpeakerRevised && " · revised"}
                    </span>
                  </div>
                  <p className="text-sm">
                    {turn.currentText || turn.originalText}
                  </p>
                  {turn.analysis?.category && (
                    <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-hud-accent/10 text-hud-accent/70">
                      {turn.analysis.category}
                    </span>
                  )}

                  {/* Turn actions */}
                  <details className="mt-1">
                    <summary className="text-xs text-hud-muted cursor-pointer">
                      Actions ▸
                    </summary>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {["A", "B", "C", "D", "E", "F"].map((label) => (
                        <button
                          key={label}
                          onClick={() =>
                            mapSpeaker(turn.providerSpeakerLabel, label)
                          }
                          className="px-2 py-1 text-xs rounded bg-hud-surface border border-hud-border text-hud-text"
                        >
                          → {label}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          const newText = prompt(
                            "Correct text:",
                            turn.currentText,
                          );
                          if (newText) correctTurn(turn.id, newText);
                        }}
                        className="px-2 py-1 text-xs rounded bg-hud-surface border border-hud-border text-hud-text"
                      >
                        ✏ Edit
                      </button>
                    </div>
                  </details>
                </div>
              ))}
            </div>
            {!followTranscript && unseenTurnCount > 0 && (
              <button
                type="button"
                onClick={() => scrollTranscriptToLatest("smooth")}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 min-h-11 rounded-full border border-hud-accent/50 bg-hud-accent px-4 py-2 text-sm font-semibold text-white shadow-xl shadow-black/40 touch-manipulation"
              >
                {unseenTurnCount} new {unseenTurnCount === 1 ? "turn" : "turns"}{" "}
                · Jump to latest
              </button>
            )}
          </section>
          <div className="hidden min-h-0 xl:flex">
            <VisualEvidenceCapture
              sessionId={sessionId}
              capturedAtMs={finalizedTurns.at(-1)?.endMs ?? 0}
              evidence={visualEvidence}
              onCaptured={(captured) =>
                setVisualEvidence((current) => [
                  captured,
                  ...current.filter((item) => item.id !== captured.id),
                ])
              }
            />
          </div>
        </div>
        <details className="shrink-0 border-t border-hud-border xl:hidden">
          <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-xs font-semibold text-fuchsia-200 marker:hidden">
            Visual evidence · {visualEvidence.length} captured +
          </summary>
          <div className="h-[52dvh] border-t border-hud-border">
            <VisualEvidenceCapture
              sessionId={sessionId}
              capturedAtMs={finalizedTurns.at(-1)?.endMs ?? 0}
              evidence={visualEvidence}
              onCaptured={(captured) =>
                setVisualEvidence((current) => [
                  captured,
                  ...current.filter((item) => item.id !== captured.id),
                ])
              }
            />
          </div>
        </details>
      </div>

      {/* Navigation */}
      <nav className="shrink-0 px-4 py-3 border-t border-hud-border flex gap-3">
        <a
          href={`/display/${sessionId}`}
          target="_blank"
          rel="noopener"
          className="flex-1 py-3 bg-hud-surface border border-hud-border text-center text-sm rounded-xl touch-manipulation"
          style={{ minHeight: 44 }}
        >
          Open Display
        </a>
        {session?.runMode !== "live" && (
          <button
            onClick={() => router.push("/runs")}
            className="flex-1 py-3 bg-hud-surface border border-hud-border text-center text-sm rounded-xl touch-manipulation"
            style={{ minHeight: 44 }}
          >
            Runs
          </button>
        )}
        <button
          onClick={() => router.push(`/runs`)}
          className="flex-1 py-3 bg-hud-surface border border-hud-border text-center text-sm rounded-xl touch-manipulation"
          style={{ minHeight: 44 }}
        >
          Export
        </button>
      </nav>
    </main>
  );
}

function newestAnalysis(
  current: LiveAnalysisSnapshot | null,
  incoming: LiveAnalysisSnapshot | null,
) {
  if (!incoming) return current;
  if (!current) return incoming;
  return Date.parse(incoming.createdAt) >= Date.parse(current.createdAt)
    ? incoming
    : current;
}

function mergeVisualEvidence(
  current: VisualEvidenceData[],
  incoming: VisualEvidenceData[],
) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => b.capturedAtMs - a.capturedAtMs);
}
