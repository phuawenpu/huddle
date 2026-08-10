"use client";

import type {
  CritiqueIntelligenceSnapshot,
  LiveAnalysisSnapshot,
  MeetingNodeKind,
  MeetingStateRelation,
  MeetingStateNode,
  WindowAnalysisSnapshot,
} from "@/lib/types";
import {
  speakerInitial,
  speakerVisualStyle,
} from "@/lib/client/speaker-visuals";

interface CompassTurn {
  id: string;
  providerSpeakerLabel?: string;
  currentText?: string;
  originalText?: string;
  startMs?: number;
  endMs?: number;
  isSubstantive?: boolean;
  isCalibration?: boolean;
  analysis?: { category?: string; theme?: string };
}

interface SemanticCompassProps {
  analysis: LiveAnalysisSnapshot | null;
  windowAnalysis: WindowAnalysisSnapshot | null;
  turns: CompassTurn[];
  objective: string;
  focusedSpeakerLabel: string | null;
  selectedTurnId: string | null;
  selectedNodeId: string | null;
  getSpeakerName: (label: string) => string;
  onSelectNode: (nodeId: string | null, sourceTurnId?: string) => void;
  onSelectTurn: (turnId: string) => void;
}

interface NowLensProps {
  analysis: LiveAnalysisSnapshot | null;
  intelligence: CritiqueIntelligenceSnapshot | null;
  windowAnalysis: WindowAnalysisSnapshot | null;
  livePrompt: { text: string } | null;
  turns: CompassTurn[];
  analyzing: boolean;
}

type CoreSlot = "issue" | "evidence" | "question" | "proposal" | "decision";

const SLOT_ORDER: CoreSlot[] = [
  "issue",
  "evidence",
  "question",
  "proposal",
  "decision",
];

const SLOT_CONFIG: Record<
  CoreSlot,
  {
    kinds: MeetingNodeKind[];
    x: number;
    y: number;
    color: string;
    soft: string;
    icon: string;
    empty: string;
  }
> = {
  issue: {
    kinds: ["issue", "need"],
    x: 50,
    y: 15,
    color: "#c084fc",
    soft: "rgba(192,132,252,.12)",
    icon: "△",
    empty: "Listening for tension",
  },
  evidence: {
    kinds: ["evidence", "criterion"],
    x: 17,
    y: 47,
    color: "#fb923c",
    soft: "rgba(251,146,60,.12)",
    icon: "▥",
    empty: "Listening for evidence",
  },
  question: {
    kinds: ["question"],
    x: 83,
    y: 45,
    color: "#86ef6b",
    soft: "rgba(134,239,107,.12)",
    icon: "?",
    empty: "Listening for questions",
  },
  proposal: {
    kinds: ["proposal"],
    x: 27,
    y: 79,
    color: "#67e8f9",
    soft: "rgba(103,232,249,.11)",
    icon: "◇",
    empty: "Listening for proposals",
  },
  decision: {
    kinds: ["decision", "action", "experiment"],
    x: 73,
    y: 79,
    color: "#fde047",
    soft: "rgba(253,224,71,.11)",
    icon: "✓",
    empty: "Listening for decisions",
  },
};

export function SemanticCompass({
  analysis,
  windowAnalysis,
  turns,
  objective,
  focusedSpeakerLabel,
  selectedTurnId,
  selectedNodeId,
  getSpeakerName,
  onSelectNode,
  onSelectTurn,
}: SemanticCompassProps) {
  const state = analysis?.result.meetingState;
  const selectedBySlot = selectCompassNodes(state?.nodes || []);
  const visibleNodes = [...selectedBySlot.values()];
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleRelations = selectCompassRelations(
    state?.relations || [],
    visibleNodeIds,
  );
  const latestTurn = turns.at(-1);
  const focus =
    windowAnalysis?.theme ||
    latestTurn?.analysis?.theme ||
    analysis?.result.headline ||
    objective ||
    "Current discussion";
  const focusQuestion =
    windowAnalysis?.openQuestions[0] ||
    state?.nodes.find((node) => node.kind === "question")?.summary ||
    "The live focus will sharpen as substantive turns accumulate.";
  const selectedNode = state?.nodes.find((node) => node.id === selectedNodeId);
  const selectedRelationships = selectedNode
    ? (state?.relations || []).filter(
        (relation) =>
          relation.fromNodeId === selectedNode.id ||
          relation.toNodeId === selectedNode.id,
      )
    : [];

  return (
    <div
      data-testid="semantic-compass"
      className="relative mx-auto h-[clamp(300px,42dvh,430px)] w-full max-w-[36rem] overflow-hidden rounded-[1.75rem] border border-blue-300/10 bg-[radial-gradient(circle_at_center,rgba(43,111,255,.14),transparent_29%),radial-gradient(circle_at_50%_48%,rgba(7,15,30,.55),rgba(3,8,16,.96)_72%)]"
      aria-label="Stable live semantic compass"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 30%, white 0 1px, transparent 1.4px), radial-gradient(circle at 78% 21%, white 0 1px, transparent 1.3px), radial-gradient(circle at 87% 69%, white 0 1px, transparent 1.4px), radial-gradient(circle at 32% 82%, white 0 1px, transparent 1.2px)",
        }}
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="semantic-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <circle
          cx="50"
          cy="51"
          r="34"
          fill="none"
          stroke="rgba(96,165,250,.14)"
          strokeDasharray="1 2"
        />
        <circle
          cx="50"
          cy="51"
          r="25"
          fill="none"
          stroke="rgba(96,165,250,.12)"
          strokeDasharray=".5 2"
        />
        {SLOT_ORDER.map((slot) => {
          const config = SLOT_CONFIG[slot];
          const node = selectedBySlot.get(slot);
          return (
            <line
              key={`spoke-${slot}`}
              x1="50"
              y1="51"
              x2={config.x}
              y2={config.y}
              stroke={config.color}
              strokeWidth={node ? 0.48 : 0.25}
              strokeOpacity={node ? 0.72 : 0.18}
            />
          );
        })}
        {visibleRelations.map((relation) => {
          const fromSlot = slotForNode(
            visibleNodes.find((node) => node.id === relation.fromNodeId),
          );
          const toSlot = slotForNode(
            visibleNodes.find((node) => node.id === relation.toNodeId),
          );
          if (!fromSlot || !toSlot) return null;
          const from = SLOT_CONFIG[fromSlot];
          const to = SLOT_CONFIG[toSlot];
          return (
            <g
              key={relation.id}
              className={
                state?.changes.addedNodeIds.some((id) =>
                  [relation.fromNodeId, relation.toNodeId].includes(id),
                )
                  ? "semantic-trace"
                  : undefined
              }
              style={{ color: from.color }}
            >
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="currentColor"
                strokeWidth="0.55"
                strokeDasharray="2 1"
                markerEnd="url(#semantic-arrow)"
              />
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 1.5}
                fill="currentColor"
                fontSize="2.8"
                textAnchor="middle"
                className="uppercase"
              >
                {relation.type.replaceAll("_", " ")}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute left-1/2 top-[51%] z-10 grid h-[8.8rem] w-[8.8rem] -translate-x-1/2 -translate-y-1/2 place-content-center rounded-full border border-blue-300/70 bg-[radial-gradient(circle_at_50%_34%,rgba(75,135,255,.28),rgba(12,31,63,.94)_68%)] px-4 text-center shadow-[0_0_34px_rgba(59,130,246,.25)] sm:h-40 sm:w-40">
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-200">
          Current focus
        </span>
        <strong className="mt-1 line-clamp-2 text-base leading-tight text-white sm:text-lg">
          {focus}
        </strong>
        <span className="mt-2 line-clamp-3 text-[9px] leading-snug text-blue-100/70 sm:text-[10px]">
          {focusQuestion}
        </span>
        <span className="mt-2 text-[9px] text-blue-200/65">
          {turns.length} source {turns.length === 1 ? "turn" : "turns"}
        </span>
      </div>

      {SLOT_ORDER.map((slot) => {
        const config = SLOT_CONFIG[slot];
        const node = selectedBySlot.get(slot);
        const contributors = node ? nodeContributors(node, turns) : [];
        const isSelected = Boolean(node && selectedNodeId === node.id);
        const isTurnLinked = Boolean(
          node &&
          selectedTurnId &&
          node.supportingTurnIds.includes(selectedTurnId),
        );
        const hasFocusedSpeaker = Boolean(
          node &&
          focusedSpeakerLabel &&
          contributors.includes(focusedSpeakerLabel),
        );
        const isDimmed = Boolean(
          focusedSpeakerLabel && node && !hasFocusedSpeaker,
        );
        const maturity = nodeMaturity(node);
        const wasAdded = Boolean(
          node && state?.changes.addedNodeIds.includes(node.id),
        );
        const wasStrengthened = Boolean(
          node && state?.changes.strengthenedNodeIds?.includes(node.id),
        );
        return (
          <button
            key={`${slot}-${node?.id || "empty"}-${state?.revision || 0}`}
            type="button"
            disabled={!node}
            aria-label={
              node
                ? `${slot}: ${node.title}. ${maturity}. Show source evidence.`
                : `${slot}: no active grounded object`
            }
            aria-pressed={isSelected}
            data-testid={`semantic-node-${slot}`}
            data-node-id={node?.id || ""}
            onClick={() =>
              node &&
              onSelectNode(
                isSelected ? null : node.id,
                node.sourceQuotes[0]?.turnId || node.supportingTurnIds[0],
              )
            }
            className={`absolute z-20 flex h-[6.4rem] w-[6.4rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border px-2 text-center transition focus:outline-none focus:ring-2 focus:ring-white/50 sm:h-28 sm:w-28 ${
              node
                ? "cursor-pointer shadow-[0_0_24px_rgba(0,0,0,.38)]"
                : "cursor-default border-dashed opacity-35"
            } ${maturity === "tentative" ? "border-dashed" : ""} ${
              isSelected || isTurnLinked ? "ring-2 ring-white/70" : ""
            } ${isDimmed ? "opacity-20" : "opacity-100"} ${wasAdded ? "semantic-bloom" : ""} ${wasStrengthened && !wasAdded ? "semantic-pulse" : ""}`}
            style={{
              left: `${config.x}%`,
              top: `${config.y}%`,
              borderColor: node ? config.color : `${config.color}55`,
              background: node
                ? `radial-gradient(circle at 50% 35%, ${config.soft}, rgba(6,12,21,.96) 72%)`
                : "rgba(4,9,17,.7)",
              boxShadow: node ? `0 0 20px ${config.color}24` : undefined,
            }}
          >
            <span
              className="text-base leading-none"
              style={{ color: config.color }}
              aria-hidden="true"
            >
              {config.icon}
            </span>
            <span
              className="mt-1 text-[8px] font-bold uppercase tracking-[0.1em]"
              style={{ color: config.color }}
            >
              {slot}
            </span>
            <span className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-tight text-white sm:text-[11px]">
              {node?.title || config.empty}
            </span>
            {node && (
              <span className="mt-1 flex -space-x-1" aria-label="Contributors">
                {contributors.slice(0, 3).map((label) => {
                  const name = getSpeakerName(label);
                  const speaker = speakerVisualStyle(label, contributors);
                  return (
                    <span
                      key={label}
                      title={`${name} contributed source speech; this does not imply agreement`}
                      className="grid h-4 w-4 place-items-center rounded-full border bg-slate-950 text-[7px] font-bold"
                      style={{
                        borderColor: speaker.color,
                        color: speaker.color,
                      }}
                    >
                      {speakerInitial(name, label)}
                    </span>
                  );
                })}
              </span>
            )}
          </button>
        );
      })}

      {selectedNode && (
        <div
          data-testid="semantic-source-popover"
          className="absolute inset-x-3 bottom-2 z-30 rounded-xl border border-white/15 bg-slate-950/95 p-2 shadow-2xl backdrop-blur"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-cyan-200">
                {selectedNode.sourceQuotes.length > 0
                  ? "✓ Grounded source"
                  : "Facilitator context"}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/85">
                “{selectedNode.sourceQuotes[0]?.quote || selectedNode.summary}”
              </p>
              {selectedNode.sourceQuotes[0] && (
                <p className="mt-0.5 text-[8px] text-hud-muted">
                  {getSpeakerName(
                    selectedNode.sourceQuotes[0].speakerLabel || "Unassigned",
                  )}{" "}
                  ·{" "}
                  {formatSessionTime(selectedNode.sourceQuotes[0].startMs || 0)}
                </p>
              )}
              {selectedRelationships.length > 0 && (
                <p className="mt-1 line-clamp-1 text-[8px] text-blue-200/70">
                  {selectedRelationships
                    .slice(0, 3)
                    .map((relation) => {
                      const otherId =
                        relation.fromNodeId === selectedNode.id
                          ? relation.toNodeId
                          : relation.fromNodeId;
                      const other = state?.nodes.find(
                        (candidate) => candidate.id === otherId,
                      );
                      return `${relation.type.replaceAll("_", " ")} ${other?.title || "related idea"}`;
                    })
                    .join(" · ")}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              {selectedNode.sourceQuotes[0]?.turnId && (
                <button
                  type="button"
                  onClick={() =>
                    onSelectTurn(selectedNode.sourceQuotes[0].turnId)
                  }
                  className="min-h-8 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-2 text-[9px] font-semibold text-cyan-100"
                >
                  Show turn
                </button>
              )}
              <button
                type="button"
                aria-label="Close source evidence"
                onClick={() => onSelectNode(null)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-hud-muted"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FacilitationNowLens({
  analysis,
  intelligence,
  windowAnalysis,
  livePrompt,
  turns,
  analyzing,
}: NowLensProps) {
  const nodes = analysis?.result.meetingState.nodes || [];
  const issue = nodes.find((node) => ["issue", "need"].includes(node.kind));
  const question = nodes.find((node) => node.kind === "question");
  const primaryAction = [
    ...(analysis?.result.meetingState.facilitatorActions || []),
  ]
    .sort((left, right) => right.priority - left.priority)
    .at(0);
  const tension =
    issue?.title ||
    intelligence?.evidenceGaps[0]?.summary ||
    windowAnalysis?.discussionState ||
    "Listening for the main tension";
  const openLoop =
    question?.title ||
    intelligence?.openLoops[0]?.summary ||
    windowAnalysis?.openQuestions[0] ||
    "No grounded open loop yet";
  const prompt =
    primaryAction?.prompt ||
    livePrompt?.text ||
    deriveFacilitationPrompt(nodes, turns) ||
    "Listen for the next useful facilitation move";
  const capturedThrough = turns.at(-1)?.endMs || 0;
  const changedNodeIds = new Set([
    ...(analysis?.result.meetingState.changes.addedNodeIds || []),
    ...(analysis?.result.meetingState.changes.strengthenedNodeIds || []),
  ]);
  const changedKinds = new Set(
    nodes
      .filter((node) => changedNodeIds.has(node.id))
      .map((node) => node.kind),
  );
  const tensionChanged = changedKinds.has("issue") || changedKinds.has("need");
  const openLoopChanged = changedKinds.has("question");
  const promptChanged = [...changedKinds].some((kind) =>
    [
      "proposal",
      "criterion",
      "evidence",
      "decision",
      "action",
      "experiment",
    ].includes(kind),
  );

  return (
    <section
      data-testid="now-lens"
      className="rounded-2xl border border-blue-300/20 bg-[linear-gradient(135deg,rgba(27,48,72,.88),rgba(8,17,31,.95))] p-2.5 shadow-[0_12px_35px_rgba(0,0,0,.22)]"
      aria-label="Now Lens: current facilitation priority"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">
          ◎ Now Lens
        </h2>
        <span className="text-[8px] uppercase tracking-wider text-hud-muted">
          {analyzing
            ? "reconciling"
            : `through ${formatSessionTime(capturedThrough)}`}
        </span>
      </header>
      <div className="grid grid-cols-3 divide-x divide-white/15">
        <NowField
          label="Main tension"
          value={tension}
          color="#c084fc"
          highlight={tensionChanged}
        />
        <NowField
          label="Open loop"
          value={openLoop}
          color="#86ef6b"
          highlight={openLoopChanged}
        />
        <NowField
          label="Prompt"
          value={prompt}
          color="#fb923c"
          highlight={promptChanged}
        />
      </div>
    </section>
  );
}

function NowField({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: string;
  color: string;
  highlight: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg px-2 first:pl-0 last:pr-0 ${highlight ? "semantic-lens-highlight" : ""}`}
    >
      <p
        className="text-[8px] font-bold uppercase tracking-[0.08em]"
        style={{ color }}
      >
        {label}
      </p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/85 sm:text-xs">
        {value}
      </p>
    </div>
  );
}

export function selectCompassNodes(nodes: MeetingStateNode[]) {
  const selected = new Map<CoreSlot, MeetingStateNode>();
  const ranked = [...nodes].sort((left, right) => {
    const leftGrounding = left.sourceQuotes.length > 0 ? 1 : 0;
    const rightGrounding = right.sourceQuotes.length > 0 ? 1 : 0;
    return (
      rightGrounding - leftGrounding ||
      right.supportingTurnIds.length - left.supportingTurnIds.length ||
      right.confidence - left.confidence
    );
  });
  for (const slot of SLOT_ORDER) {
    const node = ranked.find((candidate) =>
      SLOT_CONFIG[slot].kinds.includes(candidate.kind),
    );
    if (node) selected.set(slot, node);
  }
  return selected;
}

export function selectCompassRelations(
  relations: MeetingStateRelation[],
  visibleNodeIds: Set<string>,
) {
  return relations
    .filter(
      (relation) =>
        visibleNodeIds.has(relation.fromNodeId) &&
        visibleNodeIds.has(relation.toNodeId),
    )
    .sort(
      (left, right) =>
        right.sourceQuotes.length - left.sourceQuotes.length ||
        right.supportingTurnIds.length - left.supportingTurnIds.length,
    )
    .slice(0, 5);
}

function slotForNode(node?: MeetingStateNode): CoreSlot | null {
  if (!node) return null;
  return (
    SLOT_ORDER.find((slot) => SLOT_CONFIG[slot].kinds.includes(node.kind)) ||
    null
  );
}

function nodeContributors(node: MeetingStateNode, turns: CompassTurn[]) {
  const quoteLabels = node.sourceQuotes
    .map((source) => source.speakerLabel)
    .filter((label): label is string => Boolean(label));
  const turnLabels = turns
    .filter((turn) => node.supportingTurnIds.includes(turn.id))
    .map((turn) => turn.providerSpeakerLabel)
    .filter((label): label is string => Boolean(label));
  return [...new Set([...quoteLabels, ...turnLabels])];
}

function nodeMaturity(
  node?: MeetingStateNode,
): "emerging" | "tentative" | "grounded" | "resolved" {
  if (!node) return "emerging";
  if (["accepted", "committed", "done"].includes(node.status))
    return "resolved";
  if (node.sourceQuotes.length > 0) return "grounded";
  return "tentative";
}

export function deriveFacilitationPrompt(
  nodes: MeetingStateNode[],
  turns: CompassTurn[],
) {
  const hasIssue = nodes.some((node) => ["issue", "need"].includes(node.kind));
  const evidence = nodes.filter((node) => node.kind === "evidence");
  const proposal = nodes.find((node) => node.kind === "proposal");
  const question = nodes.find((node) => node.kind === "question");
  const decision = nodes.find((node) => node.kind === "decision");
  if (hasIssue && evidence.length === 0) return "Ask for concrete evidence";
  if (!hasIssue && evidence.length > 0)
    return "Clarify what the evidence implies";
  if (proposal && question) return "Resolve the open question before deciding";
  if (proposal && evidence.length > 0)
    return "Test for agreement on the proposal";
  if (decision && !decision.owner) return "Confirm an owner and next action";
  const participationPrompt = deriveParticipationPrompt(turns);
  if (participationPrompt) return participationPrompt;
  return null;
}

function deriveParticipationPrompt(turns: CompassTurn[]) {
  const eligible = turns.filter(
    (turn) =>
      turn.isSubstantive !== false &&
      !turn.isCalibration &&
      Boolean(turn.providerSpeakerLabel) &&
      typeof turn.startMs === "number" &&
      typeof turn.endMs === "number",
  );
  const throughMs = Math.max(...eligible.map((turn) => turn.endMs || 0), 0);
  const windowStartMs = Math.max(0, throughMs - 5 * 60 * 1_000);
  const durations = new Map<string, number>();
  for (const turn of eligible) {
    const start = Math.max(windowStartMs, turn.startMs || 0);
    const end = Math.min(throughMs, turn.endMs || start);
    if (end <= start || !turn.providerSpeakerLabel) continue;
    durations.set(
      turn.providerSpeakerLabel,
      (durations.get(turn.providerSpeakerLabel) || 0) + (end - start),
    );
  }
  const total = [...durations.values()].reduce(
    (sum, duration) => sum + duration,
    0,
  );
  if (durations.size < 2 || total < 30_000) return null;
  const shares = [...durations.values()].map((duration) => duration / total);
  if (Math.max(...shares) >= 0.6 && Math.min(...shares) <= 0.2) {
    return "Invite another perspective";
  }
  return null;
}

function formatSessionTime(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
