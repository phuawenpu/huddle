"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import type { CritiqueIntelligenceSnapshot } from "@/lib/types";

interface TranscriptTurn {
  id: string;
  providerSpeakerLabel: string;
  currentText: string;
  startMs: number;
  endMs: number;
  isFinal: boolean;
  isSubstantive: boolean;
  isCalibration: boolean;
  isUnknownSpeaker: boolean;
  possibleOverlap: boolean;
  wasSpeakerRevised?: boolean;
  analysis?: {
    category?: string;
    evidence?: string;
    signals?: Array<{ kind?: string }>;
  };
}

interface SpeakerMapping {
  speakerLabel: string;
  participantId?: string;
}

interface Participant {
  id: string;
  displayName: string;
  isHidden: boolean;
}

interface DiscussionItem {
  id: string;
  category: string;
  text: string;
  status: string;
}

interface SessionMetrics {
  talkShare?: Record<string, number>;
  categoryCounts?: Record<string, number>;
  substantiveTurnCount?: number;
  streamingMinutesUsed?: number;
}

interface PromptData {
  id: string;
  text: string;
  confidence: number;
}

interface SessionInfo {
  title: string;
  objective: string;
  status: string;
  runMode: string;
}

export default function DisplayPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [mappings, setMappings] = useState<SpeakerMapping[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [items, setItems] = useState<DiscussionItem[]>([]);
  const [metrics, setMetrics] = useState<SessionMetrics>({});
  const [intelligence, setIntelligence] =
    useState<CritiqueIntelligenceSnapshot | null>(null);
  const [prompt, setPrompt] = useState<PromptData | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Connect to SSE
  useEffect(() => {
    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource(`/api/sessions/${sessionId}/events`);
      eventSourceRef.current = es;
      es.onopen = () => {
        setConnected(true);
        setReconnectAttempt(0);
      };

      es.addEventListener("snapshot", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.session) setSession(data.session);
          if (data.turns) setTurns(data.turns);
          if (data.speakerMappings) setMappings(data.speakerMappings);
          if (data.participants) setParticipants(data.participants);
          if (data.items) setItems(data.items);
          if (data.metrics) setMetrics(data.metrics);
          if (data.intelligence) setIntelligence(data.intelligence);
        } catch {}
      });

      es.addEventListener("turn.final", (e) => {
        try {
          const turn = JSON.parse(e.data);
          setTurns((prev) => {
            const idx = prev.findIndex((t) => t.id === turn.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = turn;
              return next;
            }
            return [...prev, turn].slice(-20); // keep last 20
          });
        } catch {}
      });

      es.addEventListener("turn.updated", (e) => {
        try {
          const turn = JSON.parse(e.data);
          setTurns((prev) => prev.map((t) => (t.id === turn.id ? turn : t)));
        } catch {}
      });

      es.addEventListener("map.patch", (e) => {
        try {
          const item = JSON.parse(e.data);
          setItems((prev) => [...prev.filter((i) => i.id !== item.id), item]);
        } catch {}
      });

      es.addEventListener("prompt.show", (e) => {
        try {
          const p = JSON.parse(e.data);
          setPrompt(p);
        } catch {}
      });

      es.addEventListener("prompt.clear", () => {
        setPrompt(null);
      });

      es.addEventListener("metrics", (e) => {
        try {
          setMetrics(JSON.parse(e.data));
        } catch {}
      });

      es.addEventListener("intelligence", (e) => {
        try {
          setIntelligence(JSON.parse(e.data));
        } catch {}
      });

      es.addEventListener("status", (e) => {
        try {
          const data = JSON.parse(e.data);
          setSession((s) => (s ? { ...s, status: data.status } : s));
        } catch {}
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        // Reconnect with backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 15000);
        setReconnectAttempt((a) => a + 1);
        retryTimeout = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      clearTimeout(retryTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [sessionId]);

  const getSpeakerName = (label: string): string => {
    if (!label) return "Unassigned";
    const mapping = mappings.find((m) => m.speakerLabel === label);
    if (mapping?.participantId) {
      const p = participants.find((p) => p.id === mapping.participantId);
      if (p && !p.isHidden) return p.displayName;
    }
    return /^speaker\b/i.test(label) ? label : `Speaker ${label}`;
  };

  const talkShareEntries = Object.entries(metrics.talkShare || {})
    .filter(([label]) => {
      const mapping = mappings.find((m) => m.speakerLabel === label);
      const p = mapping?.participantId
        ? participants.find((p) => p.id === mapping.participantId)
        : null;
      return !p?.isHidden;
    })
    .sort((a, b) => b[1] - a[1]);

  const lastTurns = turns
    .filter((t) => t.isFinal && !t.isCalibration)
    .slice(-5);
  const isSimulation = session?.runMode !== "live";

  return (
    <main className="min-h-dvh flex flex-col bg-hud-bg text-hud-text safe-top safe-bottom safe-left safe-right overscroll-none">
      {/* Header */}
      <header className="px-6 py-4 border-b border-hud-border flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {session?.title || "Critique HUD"}
          </h1>
          <p className="text-sm text-hud-muted mt-1">
            {session?.objective?.slice(0, 80) || ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSimulation && (
            <span className="px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-sm font-bold rounded-lg">
              ◆ SIMULATION
            </span>
          )}
          <span
            className={`w-3 h-3 rounded-full ${session?.status === "active" ? "bg-green-400 animate-pulse" : "bg-gray-500"}`}
          />
          <span className="text-sm text-hud-muted">
            {session?.status || "setup"}
            {!connected && session?.status === "active" && " · reconnecting…"}
          </span>
        </div>
      </header>

      {/* Prompt banner */}
      {prompt && (
        <div className="mx-6 mt-3 p-3 bg-hud-accent/10 border border-hud-accent/30 rounded-xl text-sm text-hud-accent animate-fade-in">
          💡 {prompt.text}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 sm:p-6 overflow-hidden">
        {/* Transcript panel (left, ~55%) */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-xs font-semibold text-hud-muted uppercase tracking-wider mb-2 px-1">
            Transcript
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 overscroll-contain">
            {lastTurns.length === 0 && (
              <p className="text-hud-muted text-sm py-12 text-center">
                {session?.status === "active"
                  ? "Waiting for discussion to begin…"
                  : session?.status === "terminated"
                    ? "Session ended."
                    : "Session not started."}
              </p>
            )}
            {lastTurns.map((turn) => (
              <div
                key={turn.id}
                className={`p-3 rounded-lg border ${
                  turn.isSubstantive
                    ? "border-hud-border bg-hud-surface animate-fade-in"
                    : "border-hud-border/50 bg-hud-surface/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      turn.isUnknownSpeaker
                        ? "bg-gray-600/30 text-gray-400"
                        : "bg-hud-accent/20 text-hud-accent"
                    }`}
                  >
                    {turn.isUnknownSpeaker
                      ? "Unassigned"
                      : getSpeakerName(turn.providerSpeakerLabel)}
                  </span>
                  {(turn.analysis?.signals?.[0]?.kind ||
                    turn.analysis?.category) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-hud-accent/5 text-hud-accent/60">
                      {turn.analysis?.signals?.[0]?.kind ||
                        turn.analysis?.category}
                    </span>
                  )}
                  {turn.possibleOverlap && (
                    <span className="text-[10px] text-yellow-400/60">
                      ⌇ overlap
                    </span>
                  )}
                  {turn.wasSpeakerRevised && (
                    <span className="text-[10px] text-blue-400/60">
                      ↻ revised
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed">{turn.currentText}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: critique intelligence + discussion map + participation */}
        <div className="lg:w-96 flex flex-col gap-4 min-w-0">
          {/* Critique Radar */}
          <div className="bg-hud-surface border border-hud-accent/30 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-hud-accent uppercase tracking-wider">
                  Critique Radar
                </h3>
                <p className="text-[11px] text-hud-muted mt-1">
                  Source-linked signals, never participant scores
                </p>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-full bg-hud-accent/10 text-hud-accent whitespace-nowrap">
                {intelligence?.analyzedTurnCount || 0} analyzed
              </span>
            </div>

            {(intelligence?.criteriaCoverage.length || 0) > 0 ? (
              <div className="space-y-2">
                {intelligence?.criteriaCoverage.slice(0, 4).map((criterion) => (
                  <div
                    key={criterion.criterion}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="truncate text-hud-text/85">
                      {criterion.criterion}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap ${
                        criterion.status === "evidenced"
                          ? "bg-green-500/15 text-green-400"
                          : criterion.status === "discussed"
                            ? "bg-yellow-500/15 text-yellow-400"
                            : "bg-gray-500/15 text-gray-400"
                      }`}
                    >
                      {criterion.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-hud-muted">
                Radar activates when critique turns are analyzed.
              </p>
            )}

            <div className="grid grid-cols-4 gap-2 mt-4">
              <RadarCount
                label="Open"
                value={intelligence?.openLoops.length || 0}
                tone="text-purple-400"
              />
              <RadarCount
                label="Options"
                value={intelligence?.alternatives.length || 0}
                tone="text-orange-400"
              />
              <RadarCount
                label="Decisions"
                value={intelligence?.decisions.length || 0}
                tone="text-green-400"
              />
              <RadarCount
                label="Actions"
                value={intelligence?.actions.length || 0}
                tone="text-yellow-400"
              />
            </div>
            {(intelligence?.evidenceGaps.length || 0) > 0 && (
              <p className="text-[11px] text-hud-muted mt-3 pt-3 border-t border-hud-border/50">
                {intelligence?.evidenceGaps.length} claim
                {intelligence?.evidenceGaps.length === 1 ? "" : "s"} could use
                clearer evidence.
              </p>
            )}
          </div>

          {/* Talk share */}
          <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-hud-muted uppercase tracking-wider mb-3">
              Participation
            </h3>
            {talkShareEntries.length === 0 && (
              <p className="text-xs text-hud-muted">No data yet</p>
            )}
            {talkShareEntries.map(([label, pct]) => (
              <div key={label} className="mb-2 last:mb-0">
                <div className="flex justify-between text-xs mb-1">
                  <span>{getSpeakerName(label)}</span>
                  <span className="text-hud-muted">{pct}%</span>
                </div>
                <div className="h-2 bg-hud-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-hud-accent/60 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="mt-3 text-xs text-hud-muted">
              {metrics.substantiveTurnCount || 0} substantive turns
              {metrics.streamingMinutesUsed !== undefined &&
                ` · ${metrics.streamingMinutesUsed.toFixed(1)}m streaming`}
            </div>
          </div>

          {/* Source-linked critique items */}
          <div className="bg-hud-surface border border-hud-border rounded-xl p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-hud-muted uppercase tracking-wider mb-3">
              Source Map
            </h3>
            <p className="text-[10px] text-hud-muted mb-3">
              Exact-turn signals only; window summaries never enter this map.
            </p>
            {items.filter((i) => i.status === "open").length === 0 && (
              <p className="text-xs text-hud-muted">No items yet</p>
            )}
            {items
              .filter((i) => i.status === "open")
              .slice(0, 20)
              .map((item) => (
                <div
                  key={item.id}
                  className="mb-2 pb-2 border-b border-hud-border/30 last:border-0 last:pb-0"
                >
                  <span
                    className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${categoryColor(
                      item.category,
                    )}`}
                  >
                    {item.category}
                  </span>
                  <p className="text-xs mt-1 text-hud-text/80">{item.text}</p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <footer className="px-6 py-2 border-t border-hud-border flex items-center justify-between text-xs text-hud-muted">
        <span>
          {connected ? "● Live" : "○ Connecting…"}
          {reconnectAttempt > 0 && ` (attempt ${reconnectAttempt})`}
        </span>
        <span>Critique HUD</span>
      </footer>
    </main>
  );
}

function RadarCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="bg-hud-bg/70 rounded-lg px-2 py-2 text-center">
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wide text-hud-muted">
        {label}
      </div>
    </div>
  );
}

function categoryColor(cat: string): string {
  switch (cat) {
    case "evidence":
      return "bg-blue-500/20 text-blue-400";
    case "questions":
      return "bg-purple-500/20 text-purple-400";
    case "positions":
      return "bg-orange-500/20 text-orange-400";
    case "decisions":
      return "bg-green-500/20 text-green-400";
    case "actions":
      return "bg-yellow-500/20 text-yellow-400";
    case "themes":
      return "bg-pink-500/20 text-pink-400";
    default:
      return "bg-gray-500/20 text-gray-400";
  }
}
