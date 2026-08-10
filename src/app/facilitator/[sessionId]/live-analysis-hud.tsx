"use client";

import { useEffect, useState } from "react";
import type {
  CritiqueIntelligenceSnapshot,
  FacilitatorAction,
  LiveAnalysisSnapshot,
  MeetingNodeKind,
  MeetingNodeStatus,
  MeetingStateNode,
  WindowAnalysisSnapshot,
} from "@/lib/types";
import { FacilitationNowLens, SemanticCompass } from "./semantic-compass";

interface HudTurn {
  id: string;
  providerSpeakerLabel?: string;
  currentText?: string;
  originalText?: string;
  startMs?: number;
  isSubstantive: boolean;
  isCalibration: boolean;
  endMs?: number;
  analysis?: {
    category?: string;
    theme?: string;
  };
}

interface NodeEdit {
  title: string;
  summary: string;
  status: MeetingNodeStatus;
  owner?: string;
}

interface LiveAnalysisHudProps {
  analysis: LiveAnalysisSnapshot | null;
  intelligence: CritiqueIntelligenceSnapshot | null;
  windowAnalysis: WindowAnalysisSnapshot | null;
  livePrompt: {
    id: string;
    text: string;
    confidence: number;
    supportingTurnIds: string[];
  } | null;
  turns: HudTurn[];
  objective: string;
  phase: string;
  criteriaText: string;
  analyzing: boolean;
  ready: boolean;
  busyNodeId: string | null;
  publishedNodeIds: string[];
  focusedSpeakerLabel: string | null;
  selectedTurnId: string | null;
  selectedNodeId: string | null;
  getSpeakerName: (label: string) => string;
  onObjectiveChange: (value: string) => void;
  onPhaseChange: (value: string) => void;
  onCriteriaChange: (value: string) => void;
  onAnalyze: () => void;
  onEditNode: (nodeId: string, edit: NodeEdit) => Promise<void>;
  onPublishNode: (nodeId: string, text: string) => Promise<void>;
  onSelectNode: (nodeId: string | null, sourceTurnId?: string) => void;
  onSelectTurn: (turnId: string) => void;
}

const PHASE_LABELS: Record<string, string> = {
  frame: "Frame",
  empathize: "Empathize",
  define: "Define",
  ideate: "Ideate",
  evaluate: "Evaluate",
  decide: "Decide",
  plan_experiment: "Plan experiment",
  reflect: "Reflect",
};

const LANES: Array<{
  label: string;
  description: string;
  kinds: MeetingNodeKind[];
  tone: string;
}> = [
  {
    label: "Understand",
    description: "Issues, user needs, and open questions",
    kinds: ["issue", "need", "question"],
    tone: "border-cyan-300/25 bg-cyan-300/[0.04]",
  },
  {
    label: "Explore",
    description: "Proposals, evidence, and criteria",
    kinds: ["proposal", "evidence", "criterion"],
    tone: "border-violet-300/25 bg-violet-300/[0.04]",
  },
  {
    label: "Commit",
    description: "Decisions, actions, and experiments",
    kinds: ["decision", "action", "experiment"],
    tone: "border-emerald-300/25 bg-emerald-300/[0.04]",
  },
];

const KIND_TONES: Record<MeetingNodeKind, string> = {
  issue: "bg-rose-400/15 text-rose-200 border-rose-300/25",
  need: "bg-cyan-400/15 text-cyan-200 border-cyan-300/25",
  question: "bg-violet-400/15 text-violet-200 border-violet-300/25",
  proposal: "bg-blue-400/15 text-blue-200 border-blue-300/25",
  criterion: "bg-slate-400/15 text-slate-200 border-slate-300/25",
  evidence: "bg-sky-400/15 text-sky-200 border-sky-300/25",
  decision: "bg-emerald-400/15 text-emerald-200 border-emerald-300/25",
  action: "bg-amber-400/15 text-amber-100 border-amber-300/25",
  experiment: "bg-fuchsia-400/15 text-fuchsia-200 border-fuchsia-300/25",
};

const ACTION_TONES: Record<FacilitatorAction["type"], string> = {
  ask: "border-violet-300/30 bg-violet-300/[0.07]",
  clarify: "border-cyan-300/30 bg-cyan-300/[0.07]",
  compare: "border-blue-300/30 bg-blue-300/[0.07]",
  surface_tension: "border-rose-300/30 bg-rose-300/[0.07]",
  test: "border-fuchsia-300/30 bg-fuchsia-300/[0.07]",
  decide: "border-emerald-300/30 bg-emerald-300/[0.07]",
  confirm_owner: "border-amber-300/30 bg-amber-300/[0.07]",
  summarize: "border-slate-300/30 bg-slate-300/[0.07]",
};

export function LiveAnalysisHud({
  analysis,
  intelligence,
  windowAnalysis,
  livePrompt,
  turns,
  objective,
  phase,
  criteriaText,
  analyzing,
  ready,
  busyNodeId,
  publishedNodeIds,
  focusedSpeakerLabel,
  selectedTurnId,
  selectedNodeId,
  getSpeakerName,
  onObjectiveChange,
  onPhaseChange,
  onCriteriaChange,
  onAnalyze,
  onEditNode,
  onPublishNode,
  onSelectNode,
  onSelectTurn,
}: LiveAnalysisHudProps) {
  const substantiveTurns = turns.filter(
    (turn) => turn.isSubstantive && !turn.isCalibration,
  );
  const newSinceSnapshot = analysis
    ? Math.max(0, substantiveTurns.length - analysis.transcriptTurnCount)
    : substantiveTurns.length;
  const state = analysis?.result.meetingState;
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);
  const selectedAction = state?.facilitatorActions.find(
    (action) => action.id === selectedActionId,
  );

  const copyAction = async (action: FacilitatorAction) => {
    await navigator.clipboard?.writeText(action.prompt);
    setCopiedActionId(action.id);
    window.setTimeout(() => setCopiedActionId(null), 1600);
  };

  return (
    <section
      data-testid="live-analysis-hud"
      className="shrink-0 border-b border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_40%),linear-gradient(115deg,rgba(20,20,31,0.99),rgba(8,10,16,0.99))]"
      aria-label="Live meeting intelligence"
    >
      <div className="mx-auto max-w-5xl space-y-2 px-2.5 py-2.5 sm:px-4">
        <SemanticCompass
          analysis={analysis}
          windowAnalysis={windowAnalysis}
          turns={turns}
          objective={objective}
          focusedSpeakerLabel={focusedSpeakerLabel}
          selectedTurnId={selectedTurnId}
          selectedNodeId={selectedNodeId}
          getSpeakerName={getSpeakerName}
          onSelectNode={onSelectNode}
          onSelectTurn={onSelectTurn}
        />
        <FacilitationNowLens
          analysis={analysis}
          intelligence={intelligence}
          windowAnalysis={windowAnalysis}
          livePrompt={livePrompt}
          turns={turns}
          analyzing={analyzing}
        />
      </div>
      <details className="group" data-testid="meeting-intelligence-details">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between border-t border-cyan-300/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100 marker:hidden">
          <span>Analysis controls and source inspector</span>
          <span className="text-hud-muted">
            <span className="group-open:hidden">Open +</span>
            <span className="hidden group-open:inline">Close −</span>
          </span>
        </summary>
        <div className="max-h-[52dvh] overflow-y-auto border-t border-cyan-300/15 px-3 py-3 sm:px-4">
          <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="min-w-0 space-y-3">
              <header className="rounded-2xl border border-cyan-300/20 bg-black/20 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="relative flex h-2.5 w-2.5"
                        aria-hidden="true"
                      >
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-50" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
                      </span>
                      <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">
                        Meeting state
                      </h2>
                      {state && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-hud-muted">
                          revision {state.revision}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-hud-muted">
                      {analysis
                        ? `Intent · ${analysis.objective}`
                        : "Private facilitator workspace"}
                    </p>
                    <h3 className="mt-1 text-base font-semibold leading-snug text-white sm:text-lg">
                      {analyzing
                        ? "Refreshing issues, options, commitments, and tensions…"
                        : analysis?.result.headline ||
                          "Build a shared understanding as the discussion develops."}
                    </h3>
                    <p className="mt-1 max-w-4xl text-xs leading-relaxed text-hud-text/75 sm:text-sm">
                      {analysis?.result.summary ||
                        "Run synthesis when there is enough context. The AI proposes a private meaning map and next facilitation moves; nothing is published automatically."}
                    </p>
                  </div>
                  {analysis && (
                    <div className="flex flex-wrap justify-end gap-1.5 text-[10px]">
                      <span className="rounded-full border border-hud-border bg-hud-bg/70 px-2 py-1 text-hud-muted">
                        through{" "}
                        {formatSessionTime(analysis.transcriptThroughMs)}
                      </span>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-200">
                        {analysis.result.grounding?.validatedSourceCount || 0}{" "}
                        verified anchors
                      </span>
                      {state && state.changes.addedNodeIds.length > 0 && (
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-cyan-200">
                          {state.changes.addedNodeIds.length} new concepts
                        </span>
                      )}
                      {analysis.result.engine !== "model" && (
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-200">
                          deterministic view
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {analysis?.result.warning && (
                  <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-200">
                    {analysis.result.warning}
                  </p>
                )}
                {analysis && newSinceSnapshot > 0 && (
                  <p className="mt-2 inline-flex rounded-full bg-cyan-400/10 px-2 py-1 text-[11px] font-medium text-cyan-200">
                    The discussion has moved on · refresh to include{" "}
                    {newSinceSnapshot} new{" "}
                    {newSinceSnapshot === 1 ? "turn" : "turns"}
                  </p>
                )}
              </header>

              <section
                className="rounded-2xl border border-hud-border bg-hud-surface/55 p-3"
                aria-labelledby="action-dock-title"
              >
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3
                      id="action-dock-title"
                      className="text-[11px] font-bold uppercase tracking-[0.18em] text-white"
                    >
                      Facilitator action dock
                    </h3>
                    <p className="mt-0.5 text-[10px] text-hud-muted">
                      Private, ranked suggestions. You choose if and how to use
                      them.
                    </p>
                  </div>
                  {selectedAction && (
                    <button
                      type="button"
                      onClick={() => void copyAction(selectedAction)}
                      className="min-h-9 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100"
                    >
                      {copiedActionId === selectedAction.id
                        ? "Copied"
                        : "Copy prompt"}
                    </button>
                  )}
                </div>
                {(state?.facilitatorActions.length || 0) > 0 ? (
                  <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {state?.facilitatorActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        aria-pressed={selectedActionId === action.id}
                        onClick={() =>
                          setSelectedActionId((current) =>
                            current === action.id ? null : action.id,
                          )
                        }
                        className={`min-h-11 rounded-xl border p-2 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan-300/40 ${ACTION_TONES[action.type]} ${
                          selectedActionId === action.id
                            ? "ring-2 ring-cyan-300/50"
                            : ""
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">
                            {action.label}
                          </span>
                          <span className="text-[9px] uppercase tracking-wide text-hud-muted">
                            {action.urgency}
                          </span>
                        </span>
                        <span className="mt-1 block line-clamp-2 text-[10px] leading-relaxed text-hud-text/75">
                          {action.prompt}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-hud-muted">
                    Suggestions appear when the map contains a grounded open
                    question, tension, unsupported proposal, or unowned action.
                  </p>
                )}
                {selectedAction && (
                  <div
                    className="mt-2 rounded-xl border border-cyan-300/20 bg-black/25 p-3"
                    aria-live="polite"
                  >
                    <p className="text-sm font-medium leading-relaxed text-cyan-50">
                      “{selectedAction.prompt}”
                    </p>
                    <p className="mt-1 text-[10px] text-hud-muted">
                      Why now: {selectedAction.rationale}
                    </p>
                    <SourceTrail sources={selectedAction.sourceQuotes} />
                  </div>
                )}
              </section>

              {state && (
                <section aria-labelledby="meaning-map-title">
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2 px-1">
                    <div>
                      <h3
                        id="meaning-map-title"
                        className="text-[11px] font-bold uppercase tracking-[0.18em] text-white"
                      >
                        Meaning map
                      </h3>
                      <p className="mt-0.5 text-[10px] text-hud-muted">
                        Edit private AI interpretations, then publish only the
                        cards useful to the room.
                      </p>
                    </div>
                    <span className="text-[10px] text-hud-muted">
                      AI private → facilitator review → shared display
                    </span>
                  </div>
                  <div className="grid gap-2 lg:grid-cols-3">
                    {LANES.map((lane) => (
                      <MeetingLane
                        key={lane.label}
                        lane={lane}
                        nodes={state.nodes.filter((node) =>
                          lane.kinds.includes(node.kind),
                        )}
                        analysis={analysis}
                        busyNodeId={busyNodeId}
                        publishedNodeIds={publishedNodeIds}
                        onEditNode={onEditNode}
                        onPublishNode={onPublishNode}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>

            <AnalysisIntentForm
              objective={objective}
              phase={phase}
              criteriaText={criteriaText}
              ready={ready}
              analyzing={analyzing}
              turnCount={substantiveTurns.length}
              onObjectiveChange={onObjectiveChange}
              onPhaseChange={onPhaseChange}
              onCriteriaChange={onCriteriaChange}
              onAnalyze={onAnalyze}
            />
          </div>
        </div>
      </details>
    </section>
  );
}

function MeetingLane({
  lane,
  nodes,
  analysis,
  busyNodeId,
  publishedNodeIds,
  onEditNode,
  onPublishNode,
}: {
  lane: (typeof LANES)[number];
  nodes: MeetingStateNode[];
  analysis: LiveAnalysisSnapshot;
  busyNodeId: string | null;
  publishedNodeIds: string[];
  onEditNode: LiveAnalysisHudProps["onEditNode"];
  onPublishNode: LiveAnalysisHudProps["onPublishNode"];
}) {
  return (
    <div className={`min-w-0 rounded-2xl border p-2 ${lane.tone}`}>
      <div className="px-1 pb-2">
        <h4 className="text-xs font-bold text-white">{lane.label}</h4>
        <p className="text-[9px] text-hud-muted">{lane.description}</p>
      </div>
      <div className="space-y-2">
        {nodes.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 px-2 py-4 text-center text-[10px] text-hud-muted">
            No grounded concepts yet
          </p>
        )}
        {nodes.slice(0, 10).map((node) => (
          <MeetingNodeCard
            key={node.id}
            node={node}
            agreement={analysis.result.meetingState.agreements.find(
              (item) => item.targetNodeId === node.id,
            )}
            busy={busyNodeId === node.id}
            published={publishedNodeIds.includes(node.id)}
            onEditNode={onEditNode}
            onPublishNode={onPublishNode}
          />
        ))}
      </div>
    </div>
  );
}

function MeetingNodeCard({
  node,
  agreement,
  busy,
  published,
  onEditNode,
  onPublishNode,
}: {
  node: MeetingStateNode;
  agreement?: LiveAnalysisSnapshot["result"]["meetingState"]["agreements"][number];
  busy: boolean;
  published: boolean;
  onEditNode: LiveAnalysisHudProps["onEditNode"];
  onPublishNode: LiveAnalysisHudProps["onPublishNode"];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NodeEdit>(() => ({
    title: node.title,
    summary: node.summary,
    status: node.status,
    owner: node.owner,
  }));
  const nodeSignature = `${node.title}\u0000${node.summary}\u0000${node.status}\u0000${node.owner || ""}`;
  useEffect(() => {
    setDraft({
      title: node.title,
      summary: node.summary,
      status: node.status,
      owner: node.owner,
    });
  }, [nodeSignature]);

  const save = async () => {
    await onEditNode(node.id, draft);
    setEditing(false);
  };
  const publishText = `${draft.title} — ${draft.summary}`;

  return (
    <article className="rounded-xl border border-white/10 bg-hud-bg/75 p-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${KIND_TONES[node.kind]}`}
        >
          {node.kind}
        </span>
        <div className="flex items-center gap-1 text-[9px] text-hud-muted">
          <span>{node.status}</span>
          {node.origin === "human_edit" && (
            <span className="rounded-full bg-white/5 px-1.5 py-0.5">
              edited
            </span>
          )}
          {published && (
            <span className="rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-emerald-200">
              shared
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <label className="block">
            <span className="sr-only">Node title</span>
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              className="min-h-10 w-full rounded-lg border border-hud-border bg-black/25 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-300/60"
            />
          </label>
          <label className="block">
            <span className="sr-only">Node summary</span>
            <textarea
              value={draft.summary}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  summary: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-lg border border-hud-border bg-black/25 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-300/60"
            />
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <label>
              <span className="sr-only">Node status</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as MeetingNodeStatus,
                  }))
                }
                className="min-h-10 w-full rounded-lg border border-hud-border bg-hud-bg px-2 text-[10px] text-white"
              >
                {[
                  "open",
                  "exploring",
                  "proposed",
                  "accepted",
                  "rejected",
                  "committed",
                  "done",
                ].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Owner</span>
              <input
                value={draft.owner || ""}
                placeholder="Owner (optional)"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    owner: event.target.value,
                  }))
                }
                className="min-h-10 w-full rounded-lg border border-hud-border bg-black/25 px-2 text-[10px] text-white"
              />
            </label>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy || !draft.title.trim() || !draft.summary.trim()}
              onClick={() => void save()}
              className="min-h-10 flex-1 rounded-lg bg-cyan-500 px-2 text-[10px] font-bold text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save revision"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
              className="min-h-10 rounded-lg border border-hud-border px-2 text-[10px] text-hud-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <h5 className="mt-1.5 text-xs font-semibold leading-snug text-white">
            {node.title}
          </h5>
          <p className="mt-1 text-[10px] leading-relaxed text-hud-text/70">
            {node.summary}
          </p>
          {node.owner && (
            <p className="mt-1 text-[9px] text-amber-100">
              Owner · {node.owner}
            </p>
          )}
          {agreement && (
            <div
              className={`mt-2 rounded-lg px-2 py-1.5 text-[9px] ${
                agreement.state === "divided" || agreement.state === "contested"
                  ? "bg-rose-400/10 text-rose-100"
                  : agreement.state === "emerging"
                    ? "bg-amber-400/10 text-amber-100"
                    : "bg-emerald-400/10 text-emerald-100"
              }`}
            >
              <strong className="uppercase tracking-wide">
                {agreement.state}
              </strong>
              <span className="ml-1">{agreement.summary}</span>
            </div>
          )}
          <SourceTrail sources={node.sourceQuotes} />
          <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-white/5 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="min-h-10 rounded-lg border border-hud-border px-2 text-[10px] font-semibold text-hud-text hover:bg-white/5 disabled:opacity-40"
            >
              Edit interpretation
            </button>
            <button
              type="button"
              disabled={busy || published}
              onClick={() => void onPublishNode(node.id, publishText)}
              className="min-h-10 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-2 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-300/15 disabled:opacity-40"
            >
              {busy ? "Working…" : published ? "Published" : "Publish to room"}
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function SourceTrail({
  sources,
}: {
  sources: FacilitatorAction["sourceQuotes"];
}) {
  if (sources.length === 0) {
    return (
      <p className="mt-2 text-[9px] text-hud-muted">
        Facilitator-defined context
      </p>
    );
  }
  return (
    <details className="group mt-2">
      <summary className="cursor-pointer list-none text-[9px] font-medium text-cyan-200 marker:hidden">
        <span className="group-open:hidden">
          {sources.length} source {sources.length === 1 ? "anchor" : "anchors"}{" "}
          +
        </span>
        <span className="hidden group-open:inline">Hide sources −</span>
      </summary>
      <div className="mt-1 space-y-1">
        {sources.slice(0, 3).map((source) => (
          <blockquote
            key={`${source.turnId}-${source.quote}`}
            className="border-l border-cyan-300/30 pl-2 text-[9px] italic leading-relaxed text-hud-muted/90"
          >
            “{source.quote}”
            <footer className="mt-0.5 not-italic text-cyan-200/65">
              {source.speakerLabel || "Unassigned"} ·{" "}
              {formatSessionTime(source.startMs || 0)}
              {(source.uncertainty?.length || 0) > 0 &&
                ` · ${source.uncertainty?.map((value) => value.replaceAll("_", " ")).join(", ")}`}
            </footer>
          </blockquote>
        ))}
      </div>
    </details>
  );
}

function AnalysisIntentForm({
  objective,
  phase,
  criteriaText,
  ready,
  analyzing,
  turnCount,
  onObjectiveChange,
  onPhaseChange,
  onCriteriaChange,
  onAnalyze,
}: Pick<
  LiveAnalysisHudProps,
  | "objective"
  | "phase"
  | "criteriaText"
  | "ready"
  | "analyzing"
  | "onObjectiveChange"
  | "onPhaseChange"
  | "onCriteriaChange"
  | "onAnalyze"
> & { turnCount: number }) {
  return (
    <form
      className="h-fit rounded-2xl border border-hud-border bg-hud-surface/75 p-3 2xl:sticky 2xl:top-0"
      onSubmit={(event) => {
        event.preventDefault();
        onAnalyze();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-hud-muted">
            Facilitator lens
          </h3>
          <p className="mt-0.5 text-[10px] text-hud-muted/80">
            Changes create a new, traceable state revision.
          </p>
        </div>
        <span className="rounded-full bg-hud-bg px-2 py-1 text-[10px] text-hud-muted">
          {PHASE_LABELS[phase] || phase}
        </span>
      </div>
      <label className="mt-2 block">
        <span className="sr-only">Analysis objective</span>
        <input
          value={objective}
          disabled={!ready}
          onChange={(event) => onObjectiveChange(event.target.value)}
          placeholder="What should this analysis clarify?"
          className="min-h-11 w-full rounded-lg border border-hud-border bg-hud-bg/80 px-3 py-2 text-sm text-hud-text outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
        />
      </label>
      <label className="mt-2 block">
        <span className="sr-only">Critique phase</span>
        <select
          value={phase}
          disabled={!ready}
          onChange={(event) => onPhaseChange(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-hud-border bg-hud-bg/80 px-2 py-2 text-xs text-hud-text outline-none focus:border-cyan-300/60"
        >
          {Object.entries(PHASE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <details className="group mt-2">
        <summary className="min-h-10 cursor-pointer list-none py-2 text-[10px] text-hud-muted marker:hidden">
          <span className="group-open:hidden">Edit evaluation criteria +</span>
          <span className="hidden group-open:inline">Hide criteria −</span>
        </summary>
        <textarea
          value={criteriaText}
          disabled={!ready}
          onChange={(event) => onCriteriaChange(event.target.value)}
          placeholder="One criterion per line"
          rows={4}
          className="w-full rounded-lg border border-hud-border bg-hud-bg/80 px-3 py-2 text-xs text-hud-text outline-none focus:border-cyan-300/60"
        />
      </details>
      <button
        type="submit"
        disabled={
          !ready || analyzing || turnCount === 0 || !objective.trim() || !phase
        }
        className="mt-2 min-h-11 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-950/30 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {analyzing
          ? "Refreshing meeting state…"
          : `Analyze all ${turnCount} ${turnCount === 1 ? "turn" : "turns"}`}
      </button>
      <p className="mt-2 text-[9px] leading-relaxed text-hud-muted">
        Covers the complete transcript through now. Audio capture and
        transcription continue while synthesis runs.
      </p>
    </form>
  );
}

function formatSessionTime(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function humanizeKind(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
