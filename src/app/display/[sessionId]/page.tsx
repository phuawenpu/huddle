"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface TranscriptTurn {
  id: string;
  providerSpeakerLabel: string;
  currentText: string;
  startMs: number;
  isFinal: boolean;
  isSubstantive: boolean;
  isCalibration: boolean;
  isUnknownSpeaker: boolean;
  possibleOverlap: boolean;
  wasSpeakerRevised?: boolean;
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

interface PublishedItem {
  id: string;
  category: string;
  text: string;
  status: string;
  turnIds: string[];
  updatedAt?: string;
}

interface SessionInfo {
  title: string;
  objective: string;
  status: string;
  runMode: string;
}

const LANES = [
  {
    label: "Understand",
    description: "What matters and what remains unclear",
    categories: ["issue", "need", "question", "questions"],
    tone: "border-cyan-300/25 bg-cyan-300/[0.04]",
    accent: "text-cyan-200",
  },
  {
    label: "Explore",
    description: "Options and the evidence around them",
    categories: ["proposal", "evidence", "criterion", "positions", "themes"],
    tone: "border-violet-300/25 bg-violet-300/[0.04]",
    accent: "text-violet-200",
  },
  {
    label: "Commit",
    description: "What the group chose and will do next",
    categories: ["decision", "decisions", "action", "actions", "experiment"],
    tone: "border-emerald-300/25 bg-emerald-300/[0.04]",
    accent: "text-emerald-200",
  },
] as const;

export default function DisplayPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [mappings, setMappings] = useState<SpeakerMapping[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [items, setItems] = useState<PublishedItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let cancelled = false;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      es = new EventSource(`/api/sessions/${sessionId}/events`);
      eventSourceRef.current = es;
      es.onopen = () => {
        attempt = 0;
        setConnected(true);
        setReconnectAttempt(0);
      };
      es.addEventListener("snapshot", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.session) setSession(data.session);
          if (data.turns) setTurns(data.turns);
          if (data.speakerMappings) setMappings(data.speakerMappings);
          if (data.participants) setParticipants(data.participants);
          if (data.items) setItems(data.items);
        } catch {}
      });
      es.addEventListener("turn.final", (event) => {
        try {
          const turn = JSON.parse(event.data);
          setTurns((current) => {
            const index = current.findIndex((item) => item.id === turn.id);
            if (index < 0) return [...current, turn].slice(-30);
            const next = [...current];
            next[index] = turn;
            return next;
          });
        } catch {}
      });
      es.addEventListener("turn.updated", (event) => {
        try {
          const turn = JSON.parse(event.data);
          setTurns((current) =>
            current.map((item) => (item.id === turn.id ? turn : item)),
          );
        } catch {}
      });
      es.addEventListener("map.patch", (event) => {
        try {
          const item = JSON.parse(event.data) as PublishedItem;
          if (item.status !== "published") return;
          setItems((current) => [
            ...current.filter((candidate) => candidate.id !== item.id),
            item,
          ]);
        } catch {}
      });
      es.addEventListener("status", (event) => {
        try {
          const data = JSON.parse(event.data);
          setSession((current) =>
            current ? { ...current, status: data.status } : current,
          );
        } catch {}
      });
      es.onerror = () => {
        setConnected(false);
        es.close();
        attempt += 1;
        const delay = Math.min(1_000 * 2 ** (attempt - 1), 15_000);
        setReconnectAttempt(attempt);
        retryTimeout = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
      eventSourceRef.current?.close();
    };
  }, [sessionId]);

  const getSpeakerName = (label: string) => {
    if (!label) return "Unassigned";
    const mapping = mappings.find((item) => item.speakerLabel === label);
    const participant = mapping?.participantId
      ? participants.find((item) => item.id === mapping.participantId)
      : null;
    if (participant && !participant.isHidden) return participant.displayName;
    return /^speaker\b/i.test(label) ? label : `Speaker ${label}`;
  };
  const lastTurns = turns
    .filter((turn) => turn.isFinal && !turn.isCalibration)
    .slice(-6);
  const publishedItems = items.filter((item) => item.status === "published");

  return (
    <main className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-hud-bg text-hud-text safe-top safe-bottom safe-left safe-right">
      <header className="shrink-0 border-b border-hud-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Shared meeting canvas
            </p>
            <h1 className="mt-1 truncate text-xl font-bold tracking-tight sm:text-3xl">
              {session?.title || "Huddle"}
            </h1>
            <p className="mt-1 line-clamp-2 text-xs text-hud-muted sm:text-sm">
              {session?.objective || "Waiting for the facilitator to frame the discussion."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-hud-border bg-hud-surface px-3 py-1.5 text-[10px] text-hud-muted sm:text-xs">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                session?.status === "active"
                  ? "animate-pulse bg-emerald-400"
                  : "bg-gray-500"
              }`}
            />
            <span>{connected ? "Live" : "Reconnecting"}</span>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex min-h-0 min-w-0 flex-col" aria-labelledby="shared-map-title">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <h2 id="shared-map-title" className="text-xs font-bold uppercase tracking-[0.18em] text-white">
                What the group is shaping
              </h2>
              <p className="mt-0.5 text-[10px] text-hud-muted">
                Every card below was reviewed and published by the facilitator.
              </p>
            </div>
            <p className="text-[10px] text-hud-muted">Understand → Explore → Commit</p>
          </div>
          <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto lg:grid-cols-3 lg:overflow-hidden">
            {LANES.map((lane, laneIndex) => {
              const laneItems = publishedItems.filter((item) =>
                lane.categories.includes(item.category as never),
              );
              return (
                <section
                  key={lane.label}
                  className={`relative min-h-48 overflow-y-auto rounded-2xl border p-3 ${lane.tone}`}
                  aria-labelledby={`lane-${laneIndex}`}
                >
                  <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-2 rounded-xl bg-hud-bg/90 px-2 py-2 backdrop-blur">
                    <h3 id={`lane-${laneIndex}`} className={`text-sm font-bold ${lane.accent}`}>
                      {lane.label}
                    </h3>
                    <p className="text-[10px] text-hud-muted">{lane.description}</p>
                  </div>
                  {laneItems.length === 0 ? (
                    <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-white/10 px-4 text-center text-xs text-hud-muted">
                      The facilitator has not shared a card here yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {laneItems.map((item) => (
                        <PublishedCard key={item.id} item={item} turns={turns} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col rounded-2xl border border-hud-border bg-hud-surface/65 p-3" aria-labelledby="transcript-title">
          <div className="mb-2">
            <h2 id="transcript-title" className="text-xs font-bold uppercase tracking-[0.18em] text-white">
              Conversation now
            </h2>
            <p className="mt-0.5 text-[10px] text-hud-muted">
              Recent transcript for context; the canvas holds reviewed meaning.
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {lastTurns.length === 0 && (
              <p className="py-10 text-center text-xs text-hud-muted">
                {session?.status === "active"
                  ? "Listening for the discussion…"
                  : "The session has not started."}
              </p>
            )}
            {lastTurns.map((turn) => (
              <article key={turn.id} className="rounded-xl border border-hud-border/70 bg-hud-bg/70 p-2.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[9px]">
                  <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 font-semibold text-cyan-200">
                    {turn.isUnknownSpeaker ? "Unassigned" : getSpeakerName(turn.providerSpeakerLabel)}
                  </span>
                  <span className="text-hud-muted">{formatSessionTime(turn.startMs)}</span>
                  {turn.possibleOverlap && <span className="text-amber-200">possible overlap</span>}
                  {turn.wasSpeakerRevised && <span className="text-blue-200">speaker revised</span>}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-hud-text/85">{turn.currentText}</p>
              </article>
            ))}
          </div>
        </aside>
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-hud-border px-4 py-2 text-[10px] text-hud-muted sm:px-6 sm:text-xs">
        <span>{connected ? "● Synced" : `○ Reconnecting${reconnectAttempt ? ` · attempt ${reconnectAttempt}` : ""}`}</span>
        <span>AI suggestions stay private until the facilitator publishes</span>
      </footer>
    </main>
  );
}

function PublishedCard({
  item,
  turns,
}: {
  item: PublishedItem;
  turns: TranscriptTurn[];
}) {
  const sourceTurns = item.turnIds
    .map((turnId) => turns.find((turn) => turn.id === turnId))
    .filter((turn): turn is TranscriptTurn => Boolean(turn));
  return (
    <article className="animate-fade-in rounded-xl border border-white/10 bg-hud-bg/80 p-3 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-hud-muted">
          {item.category.replaceAll("_", " ")}
        </span>
        <span className="text-[9px] text-emerald-200">facilitator reviewed</span>
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed text-white">{item.text}</p>
      {sourceTurns.length > 0 && (
        <details className="group mt-2 border-t border-white/5 pt-2">
          <summary className="cursor-pointer list-none text-[9px] text-cyan-200 marker:hidden">
            <span className="group-open:hidden">Trace to transcript +</span>
            <span className="hidden group-open:inline">Hide transcript trace −</span>
          </summary>
          <div className="mt-1 space-y-1">
            {sourceTurns.slice(0, 3).map((turn) => (
              <p key={turn.id} className="border-l border-cyan-300/25 pl-2 text-[9px] text-hud-muted">
                {formatSessionTime(turn.startMs)} · {turn.currentText}
              </p>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

function formatSessionTime(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
