"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

interface SessionData {
  title: string;
  objective: string;
  phase: string;
  status: string;
  runMode: string;
  criteria: string[];
}

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
  analysis?: { category?: string };
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

const CATEGORIES = ["evidence", "questions", "positions", "decisions", "actions"] as const;

export default function DisplayPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<SessionData | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [mappings, setMappings] = useState<SpeakerMapping[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [items, setItems] = useState<DiscussionItem[]>([]);
  const [promptText, setPromptText] = useState("");
  const [talkShare, setTalkShare] = useState<Record<string, number>>({});
  const [clock, setClock] = useState("");
  const [isSimulated, setIsSimulated] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    tick();
    const int = setInterval(tick, 10000);
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    const es = new EventSource(`/api/sessions/${sessionId}/events`);

    es.addEventListener("snapshot", (e) => {
      const data = JSON.parse(e.data);
      if (data.session) {
        setSession(data.session);
        setIsSimulated(data.session.runMode?.startsWith("sim"));
      }
      if (data.turns) setTurns(data.turns || []);
      if (data.speakerMappings) setMappings(data.speakerMappings || []);
      if (data.participants) setParticipants(data.participants || []);
      if (data.items) setItems(data.items || []);
    });

    es.addEventListener("turn.final", (e) => {
      const turn = JSON.parse(e.data);
      setTurns(prev => {
        const filtered = prev.filter(t => t.id !== turn.id);
        return [...filtered, turn].slice(-3);
      });
    });

    es.addEventListener("metrics", (e) => {
      const data = JSON.parse(e.data);
      if (data.talkShare) setTalkShare(data.talkShare);
    });

    es.addEventListener("prompt.show", (e) => {
      const data = JSON.parse(e.data);
      setPromptText(data.text || "");
    });

    es.addEventListener("prompt.clear", () => setPromptText(""));

    es.addEventListener("map.patch", (e) => {
      const data = JSON.parse(e.data);
      if (data.items) setItems(data.items);
    });

    es.addEventListener("turn.updated", (e) => {
      const turn = JSON.parse(e.data);
      setTurns(prev => prev.map(t => t.id === turn.id ? turn : t));
    });

    return () => es.close();
  }, [sessionId]);

  const getSpeakerName = (label: string) => {
    const mapping = mappings.find(m => m.speakerLabel === label);
    if (mapping?.participantId) {
      const p = participants.find(p => p.id === mapping.participantId);
      if (p?.isHidden) return "—";
      return p?.displayName || label;
    }
    return label;
  };

  const visibleTurns = turns
    .filter(t => t.isFinal && t.isSubstantive && !t.isCalibration)
    .slice(-3);

  const catItems = (category: string) =>
    items.filter(i => i.category === category).slice(0, 4);

  const activeSpeakers = Object.keys(talkShare).length;

  // Font size scaling with clamp for readability at distance
  const metricsFontSize = "clamp(18px, 2vw, 32px)";

  return (
    <main className="min-h-dvh bg-hud-bg text-hud-text overflow-hidden" style={{ overscrollBehavior: "none" }}>
      {/* HUD Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-hud-border safe-top"
        style={{ fontSize: "clamp(14px, 1.5vw, 18px)" }}>
        <div className="flex items-center gap-6">
          <h1 className="font-bold" style={{ fontSize: "clamp(16px, 2vw, 22px)" }}>
            DESIGN CRITIQUE HUD
          </h1>
          {isSimulated && (
            <span className="px-3 py-1 bg-hud-sim-badge/20 text-hud-sim-badge rounded-full text-xs font-bold"
              style={{ fontSize: "clamp(10px, 1.2vw, 14px)" }}>
              ◆ SIMULATION — synthetic AI voices
            </span>
          )}
        </div>
        <span className="text-hud-muted font-mono" style={{ fontSize: "clamp(14px, 1.5vw, 18px)" }}>
          {clock}
        </span>
      </header>

      <div className="h-[calc(100dvh-100px)] flex">
        {/* Left: Transcript Panel (~60%) */}
        <div className="flex-1 flex flex-col p-4" style={{ maxWidth: "60%" }}>
          <div className="flex-1 space-y-3 overflow-hidden">
            <div className="text-hud-muted text-xs uppercase tracking-wider" style={{ fontSize: "clamp(10px, 1vw, 12px)" }}>
              Transcript
            </div>
            {visibleTurns.map(turn => (
              <div key={turn.id} className="p-3 bg-hud-surface/50 rounded-lg border border-hud-border/50"
                style={{ fontSize: "clamp(14px, 1.5vw, 18px)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-hud-accent"
                    style={{ fontSize: "clamp(12px, 1.3vw, 16px)" }}>
                    {getSpeakerName(turn.providerSpeakerLabel)}
                  </span>
                  {turn.analysis?.category && (
                    <span className="px-2 py-0.5 bg-hud-accent/10 text-hud-accent rounded text-xs"
                      style={{ fontSize: "clamp(9px, 0.9vw, 11px)" }}>
                      {turn.analysis.category}
                    </span>
                  )}
                </div>
                <p className="leading-relaxed" style={{ fontSize: "clamp(14px, 1.5vw, 18px)" }}>
                  {turn.currentText}
                </p>
              </div>
            ))}
            {visibleTurns.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-hud-muted"
                style={{ fontSize: "clamp(16px, 2vw, 24px)" }}>
                Waiting for discussion…
              </div>
            )}
          </div>
        </div>

        {/* Right: Discussion Map + Metrics */}
        <div className="w-[40%] flex flex-col p-4 border-l border-hud-border">
          {/* Objective & Status */}
          <div className="mb-3 pb-3 border-b border-hud-border/50">
            <div className="text-hud-muted text-xs" style={{ fontSize: "clamp(9px, 0.9vw, 11px)" }}>
              OBJECTIVE
            </div>
            <div style={{ fontSize: "clamp(12px, 1.2vw, 15px)" }}>
              {session?.objective || "—"}
            </div>
            <div className="flex gap-4 mt-2">
              <span className="text-hud-accent text-xs" style={{ fontSize: "clamp(9px, 0.9vw, 11px)" }}>
                {session?.phase?.toUpperCase() || ""}
              </span>
              <span className="text-hud-muted text-xs" style={{ fontSize: "clamp(9px, 0.9vw, 11px)" }}>
                {session?.status || ""}
              </span>
            </div>
          </div>

          {/* Discussion Map */}
          <div className="flex-1 overflow-hidden">
            <div className="text-hud-muted text-xs uppercase tracking-wider mb-2"
              style={{ fontSize: "clamp(9px, 0.9vw, 11px)" }}>
              Discussion Map
            </div>
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100% - 140px)" }}>
              {CATEGORIES.map(cat => {
                const catItemsList = catItems(cat);
                return (
                  <div key={cat} className="bg-hud-surface/30 rounded-lg p-2">
                    <div className="text-[10px] text-hud-muted uppercase mb-1"
                      style={{ fontSize: "clamp(8px, 0.8vw, 10px)" }}>
                      {cat} ({catItemsList.length})
                    </div>
                    {catItemsList.map(item => (
                      <div key={item.id} className="flex items-center gap-1.5 py-0.5"
                        style={{ fontSize: "clamp(10px, 1vw, 13px)" }}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          item.status === "resolved" ? "bg-hud-success" : "bg-hud-accent"
                        }`} />
                        <span className="truncate">{item.text}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Metric Strip */}
          <div className="mt-3 pt-3 border-t border-hud-border/50">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-hud-muted text-[9px] uppercase"
                  style={{ fontSize: "clamp(8px, 0.8vw, 10px)" }}>
                  Speakers
                </div>
                <div className="text-hud-text font-mono font-bold" style={{ fontSize: metricsFontSize }}>
                  {activeSpeakers}
                </div>
              </div>
              <div>
                <div className="text-hud-muted text-[9px] uppercase"
                  style={{ fontSize: "clamp(8px, 0.8vw, 10px)" }}>
                  Questions
                </div>
                <div className="text-hud-text font-mono font-bold" style={{ fontSize: metricsFontSize }}>
                  {catItems("questions").length}
                </div>
              </div>
              <div>
                <div className="text-hud-muted text-[9px] uppercase"
                  style={{ fontSize: "clamp(8px, 0.8vw, 10px)" }}>
                  Evidence
                </div>
                <div className="text-hud-text font-mono font-bold" style={{ fontSize: metricsFontSize }}>
                  {catItems("evidence").length}
                </div>
              </div>
              <div>
                <div className="text-hud-muted text-[9px] uppercase"
                  style={{ fontSize: "clamp(8px, 0.8vw, 10px)" }}>
                  Open
                </div>
                <div className="text-hud-text font-mono font-bold" style={{ fontSize: metricsFontSize }}>
                  {items.filter(i => i.status !== "resolved").length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Banner */}
      {promptText && (
        <div className="fixed bottom-0 inset-x-0 bg-hud-accent/10 border-t border-hud-accent/30 px-6 py-3"
          style={{ fontSize: "clamp(13px, 1.4vw, 16px)", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          💡 {promptText}
        </div>
      )}
    </main>
  );
}
