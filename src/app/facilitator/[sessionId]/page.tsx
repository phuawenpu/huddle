"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface SessionData {
  id: string;
  title: string;
  objective: string;
  phase: string;
  criteria: string[];
  speakerCount: number;
  status: string;
  runMode: string;
}

interface TranscriptTurn {
  id: string;
  providerSessionId: string;
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
  role: string;
  isHidden: boolean;
}

interface DiscussionItem {
  id: string;
  category: string;
  text: string;
  status: string;
}

const CATEGORIES = ["evidence", "questions", "positions", "decisions", "actions"] as const;

export default function FacilitatorPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<SessionData | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [mappings, setMappings] = useState<SpeakerMapping[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [items, setItems] = useState<DiscussionItem[]>([]);
  const [status, setStatus] = useState("loading");
  const [showDisplay, setShowDisplay] = useState(false);
  const [editingTurn, setEditingTurn] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [facilitatorPrompt, setFacilitatorPrompt] = useState("");
  const [metrics, setMetrics] = useState<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load session data
  const loadSession = useCallback(async () => {
    try {
      const [sRes, tRes, mRes, pRes, iRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/sessions/${sessionId}/turns`),
        fetch(`/api/sessions/${sessionId}/speaker-mappings`),
        fetch(`/api/sessions/${sessionId}/participants`),
        fetch(`/api/sessions/${sessionId}/items`),
      ]);
      if (sRes.ok) setSession(await sRes.json());
      if (tRes.ok) setTurns(await tRes.json());
      if (mRes.ok) setMappings(await mRes.json());
      if (pRes.ok) setParticipants(await pRes.json());
      if (iRes.ok) setItems(await iRes.json());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [sessionId]);

  useEffect(() => { loadSession(); }, [loadSession]);

  // SSE connection
  useEffect(() => {
    const es = new EventSource(`/api/sessions/${sessionId}/events`);
    eventSourceRef.current = es;

    es.addEventListener("snapshot", (e) => {
      const data = JSON.parse(e.data);
      if (data.session) setSession(data.session);
      if (data.turns) setTurns(data.turns);
      if (data.mappings) setMappings(data.mappings);
      if (data.participants) setParticipants(data.participants);
    });

    es.addEventListener("turn.final", (e) => {
      const turn = JSON.parse(e.data);
      setTurns(prev => [...prev.filter(t => t.id !== turn.id), turn]);
    });

    es.addEventListener("metrics", (e) => {
      setMetrics(JSON.parse(e.data));
    });

    es.addEventListener("prompt.show", (e) => {
      setFacilitatorPrompt(JSON.parse(e.data).text || "");
    });

    es.addEventListener("turn.updated", (e) => {
      const turn = JSON.parse(e.data);
      setTurns(prev => prev.map(t => t.id === turn.id ? turn : t));
    });

    es.addEventListener("map.patch", () => {
      fetch(`/api/sessions/${sessionId}/items`)
        .then(r => r.json())
        .then(setItems)
        .catch(() => {});
    });

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      if (data.status) {
        setSession(prev => prev ? { ...prev, status: data.status } : prev);
      }
    });

    es.onerror = () => {
      setTimeout(() => {
        es.close();
        const newEs = new EventSource(`/api/sessions/${sessionId}/events`);
        eventSourceRef.current = newEs;
      }, 2000);
    };

    return () => es.close();
  }, [sessionId]);

  const startSession = async () => {
    await fetch(`/api/sessions/${sessionId}/start`, { method: "POST" });
    setStatus("live");
  };

  const terminateSession = async () => {
    await fetch(`/api/sessions/${sessionId}/terminate`, { method: "POST" });
    loadSession();
  };

  const handleMapSpeaker = async (label: string, participantId: string) => {
    await fetch(`/api/sessions/${sessionId}/speaker-mappings/${label}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: participantId || null }),
    });
    loadSession();
  };

  const handleEditTurn = async (turnId: string) => {
    if (!editText.trim()) return;
    await fetch(`/api/turns/${turnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentText: editText }),
    });
    setEditingTurn(null);
    setEditText("");
    loadSession();
  };

  const handleAddItem = async (category: string, text: string) => {
    await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, category, text }),
    });
    loadSession();
  };

  const getSpeakerName = (label: string) => {
    const mapping = mappings.find(m => m.speakerLabel === label);
    if (mapping?.participantId) {
      const p = participants.find(p => p.id === mapping.participantId);
      return p?.displayName || label;
    }
    return label;
  };

  const substantiveTurns = turns.filter(t => t.isFinal && t.isSubstantive);

  if (status === "loading") {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <div className="text-hud-muted text-lg animate-pulse">Loading session…</div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-hud-bg text-hud-text">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-hud-bg/95 backdrop-blur-sm border-b border-hud-border px-4 py-3 safe-top">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-hud-muted hover:text-hud-text touch-manipulation"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              ←
            </button>
            <div>
              <h1 className="text-lg font-bold truncate max-w-[200px]">{session?.title || "Session"}</h1>
              <p className="text-xs text-hud-muted">{session?.phase} · {session?.status}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDisplay(!showDisplay)}
              className="px-3 py-2 text-sm bg-hud-surface border border-hud-border rounded-lg touch-manipulation"
              style={{ minHeight: 44 }}
            >
              {showDisplay ? "Hide" : "Display"}
            </button>
            {session?.status === "active" ? (
              <button
                onClick={terminateSession}
                className="px-3 py-2 text-sm bg-hud-danger text-white rounded-lg touch-manipulation"
                style={{ minHeight: 44 }}
              >
                End
              </button>
            ) : (
              <button
                onClick={startSession}
                className="px-3 py-2 text-sm bg-hud-accent text-white rounded-lg touch-manipulation"
                style={{ minHeight: 44 }}
              >
                Start
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Display Preview */}
        {showDisplay && (
          <div className="bg-hud-surface border border-hud-accent/30 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold text-hud-accent">Display Preview</h2>
              <a
                href={`/display/${sessionId}`}
                target="_blank"
                className="text-sm text-hud-accent underline"
              >
                Open in new tab ↗
              </a>
            </div>
            <div className="space-y-2">
              {substantiveTurns.slice(-3).map(t => (
                <div key={t.id} className="flex gap-2 text-sm">
                  <span className="text-hud-accent font-medium">{getSpeakerName(t.providerSpeakerLabel)}</span>
                  <span className="text-hud-muted">{t.currentText || t.originalText}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics */}
        {metrics && (
          <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-hud-muted mb-2">Session Metrics</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-hud-muted">Turns</span>
                <p className="text-hud-text font-mono">{metrics.turnCount}</p>
              </div>
              <div>
                <span className="text-hud-muted">Substantive</span>
                <p className="text-hud-text font-mono">{metrics.substantiveTurnCount}</p>
              </div>
              <div>
                <span className="text-hud-muted">Minutes</span>
                <p className="text-hud-text font-mono">{metrics.streamingMinutesUsed}</p>
              </div>
            </div>
          </div>
        )}

        {/* Facilitator Prompt */}
        {facilitatorPrompt && (
          <div className="bg-hud-accent/10 border border-hud-accent/30 rounded-xl p-4">
            <p className="text-hud-text text-sm">💡 {facilitatorPrompt}</p>
            <button
              onClick={() => setFacilitatorPrompt("")}
              className="mt-2 text-xs text-hud-muted hover:text-hud-text touch-manipulation"
              style={{ minHeight: 44 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Speaker Mappings */}
        <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-hud-muted mb-3">Speaker Mappings</h2>
          <div className="space-y-2">
            {mappings.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="text-hud-accent text-sm w-8">{m.speakerLabel}</span>
                <span className="text-hud-muted text-sm">→</span>
                <select
                  value={m.participantId || ""}
                  onChange={e => handleMapSpeaker(m.speakerLabel, e.target.value)}
                  className="flex-1 px-3 py-2 bg-hud-bg border border-hud-border rounded-lg text-sm text-hud-text
                    focus:outline-none focus:border-hud-accent touch-manipulation"
                  style={{ minHeight: 44 }}
                >
                  <option value="">Unassigned</option>
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>{p.displayName}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Transcript */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-hud-muted">Transcript ({substantiveTurns.length} turns)</h2>
          {turns.filter(t => t.isFinal).map(turn => (
            <div
              key={turn.id}
              className={`p-3 rounded-xl border transition-colors ${
                turn.isSubstantive ? "bg-hud-surface border-hud-border" : "bg-hud-bg border-hud-border/50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                    turn.isCalibration ? "bg-hud-calibration/20 text-hud-calibration" : "bg-hud-accent/20 text-hud-accent"
                  }`}>
                    {getSpeakerName(turn.providerSpeakerLabel)}
                  </span>
                  {turn.isCalibration && <span className="text-[10px] text-hud-calibration">CAL</span>}
                  {!turn.isSubstantive && <span className="text-[10px] text-hud-muted">backchannel</span>}
                  {turn.isUnknownSpeaker && <span className="text-[10px] text-hud-warn">UNKNOWN</span>}
                </div>
                <span className="text-xs text-hud-muted font-mono">
                  {(turn.endMs - turn.startMs) / 1000}s
                </span>
              </div>

              {editingTurn === turn.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-hud-bg border border-hud-border rounded-lg text-sm text-hud-text
                      focus:outline-none focus:border-hud-accent resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditTurn(turn.id)}
                      className="px-3 py-1 text-xs bg-hud-accent text-white rounded touch-manipulation"
                      style={{ minHeight: 36 }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingTurn(null); setEditText(""); }}
                      className="px-3 py-1 text-xs text-hud-muted hover:text-hud-text touch-manipulation"
                      style={{ minHeight: 36 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  className="text-sm text-hud-text leading-relaxed cursor-pointer hover:text-hud-text/80"
                  onClick={() => { setEditingTurn(turn.id); setEditText(turn.currentText || turn.originalText); }}
                  style={{ minHeight: 44 }}
                >
                  {turn.currentText || turn.originalText}
                  {turn.analysis?.category && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-hud-accent/10 text-hud-accent rounded">
                      {turn.analysis.category}
                    </span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Discussion Map */}
        <div className="bg-hud-surface border border-hud-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-hud-muted mb-3">Discussion Map</h2>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => {
              const catItems = items.filter(i => i.category === cat);
              return (
                <div key={cat} className="bg-hud-bg rounded-lg p-3">
                  <h3 className="text-xs font-semibold text-hud-muted uppercase mb-2">{cat}</h3>
                  {catItems.map(item => (
                    <div key={item.id} className="text-xs text-hud-text mb-1 flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        item.status === "resolved" ? "bg-hud-success" : "bg-hud-accent"
                      }`} />
                      {item.text}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const text = window.prompt("Add item:", "");
                      if (text) handleAddItem(cat, text);
                    }}
                    className="text-xs text-hud-muted hover:text-hud-text mt-1 touch-manipulation"
                    style={{ minHeight: 36 }}
                  >
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
