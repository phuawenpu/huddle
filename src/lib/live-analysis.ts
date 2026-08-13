import type {
  FacilitatorAction,
  FacilitatorActionType,
  LiveAnalysisEvidence,
  LiveAnalysisFinding,
  LiveAnalysisResult,
  LiveAnalysisSourceQuote,
  MeetingNodeKind,
  MeetingNodeStatus,
  MeetingStance,
  MeetingState,
  MeetingStateNode,
  MeetingStateRelation,
  TargetAgreement,
} from "./types";
import { openAiFetch } from "./openai-client";
import { UNTRUSTED_INPUT_POLICY } from "./prompt-security";

export interface LiveAnalysisTurn {
  id: string;
  speakerLabel: string;
  text: string;
  startMs: number;
  endMs: number;
  isUnknownSpeaker?: boolean;
  possibleOverlap?: boolean;
  wasSpeakerRevised?: boolean;
  isManuallyCorrected?: boolean;
  transcriptConfidence?: number;
}

export interface LiveAnalysisVisualContext {
  id: string;
  capturedAtMs: number;
  note?: string;
  caption?: string;
  observations?: string[];
}

export interface LiveAnalysisConfig {
  objective: string;
  phase: string;
  criteria: string[];
  previousState?: MeetingState;
  previousSnapshotId?: string;
}

interface GroundingCounter {
  validatedSourceCount: number;
  rejectedSourceCount: number;
}

const MAX_CHUNK_CHARACTERS = 28_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const NODE_KINDS: MeetingNodeKind[] = [
  "issue",
  "need",
  "proposal",
  "criterion",
  "evidence",
  "question",
  "decision",
  "action",
  "experiment",
];
const NODE_STATUSES: MeetingNodeStatus[] = [
  "open",
  "exploring",
  "proposed",
  "accepted",
  "rejected",
  "committed",
  "done",
];
const ACTION_TYPES: FacilitatorActionType[] = [
  "ask",
  "clarify",
  "compare",
  "surface_tension",
  "test",
  "decide",
  "confirm_owner",
  "summarize",
];

/**
 * Build a source-grounded meeting-state revision from every finalized,
 * substantive turn available at an immutable cutoff. Capture and ASR continue
 * independently while this function runs.
 */
export async function analyzeFullTranscript(
  turns: LiveAnalysisTurn[],
  visualEvidence: LiveAnalysisVisualContext[],
  config: LiveAnalysisConfig,
): Promise<LiveAnalysisResult> {
  if (turns.length === 0) {
    throw new Error("At least one substantive transcript turn is required.");
  }

  if (process.env.LLM_STUB === "1" || !process.env.OPENAI_API_KEY) {
    return fallbackAnalysis(turns, visualEvidence, config);
  }

  try {
    const chunks = partitionTranscript(turns);
    const chunkResults: unknown[] = [];
    for (let index = 0; index < chunks.length; index++) {
      chunkResults.push(
        await requestAnalysis({
          objective: config.objective,
          phase: config.phase,
          criteria: config.criteria,
          coverage: {
            chunk: index + 1,
            chunkCount: chunks.length,
            firstTurnId: chunks[index][0].id,
            lastTurnId: chunks[index].at(-1)!.id,
            totalTranscriptTurns: turns.length,
          },
          previousState: compactPreviousState(config.previousState),
          transcript: chunks[index].map(serializeTurn),
          visualEvidence:
            index === chunks.length - 1 ? visualEvidence : undefined,
        }),
      );
    }

    const raw =
      chunkResults.length === 1
        ? chunkResults[0]
        : await requestAnalysis({
            objective: config.objective,
            phase: config.phase,
            criteria: config.criteria,
            coverage: {
              chunkCount: chunks.length,
              firstTurnId: turns[0].id,
              lastTurnId: turns.at(-1)!.id,
              totalTranscriptTurns: turns.length,
              instruction:
                "Synthesize every chunk result into one meeting state. Preserve exact source turn IDs and do not privilege recent chunks.",
            },
            previousState: compactPreviousState(config.previousState),
            chunkResults,
            visualEvidence,
          });

    return normalizeAnalysis(raw, turns, config, "model");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`Whole-transcript analysis fell back locally: ${detail}`);
    return {
      ...fallbackAnalysis(turns, visualEvidence, config),
      warning: `Model analysis was unavailable; showing deterministic semantic coverage instead (${detail.slice(0, 140)}).`,
    };
  }
}

export function partitionTranscript(
  turns: LiveAnalysisTurn[],
  maxCharacters = MAX_CHUNK_CHARACTERS,
): LiveAnalysisTurn[][] {
  const chunks: LiveAnalysisTurn[][] = [];
  let current: LiveAnalysisTurn[] = [];
  let currentCharacters = 0;

  for (const turn of turns) {
    const turnCharacters = JSON.stringify(serializeTurn(turn)).length;
    if (
      current.length > 0 &&
      currentCharacters + turnCharacters > maxCharacters
    ) {
      chunks.push(current);
      current = [];
      currentCharacters = 0;
    }
    current.push(turn);
    currentCharacters += turnCharacters;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function requestAnalysis(payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), configuredTimeoutMs());
  try {
    const response = await openAiFetch("/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANALYSIS_MODEL || "gpt-5-mini-2025-08-07",
        messages: [
          {
            role: "system",
            content: `${UNTRUSTED_INPUT_POLICY}

You maintain a live, mixed-initiative meeting map for a design facilitator. Analyze all supplied turns against the facilitator intent. Do not score people, infer emotion, or reduce the meeting to speaking/count metrics.

Return one JSON object with:
- headline and summary
- keyFindings: up to 6 {title,text,sourceQuotes}
- criteria: one {criterion,status,text,sourceQuotes} per supplied criterion; status unaddressed, discussed, or evidenced
- openQuestions, decisions, actions: arrays of {text,sourceQuotes}
- meetingState: {
    nodes: up to 32 {tempId,kind,title,summary,status,owner?,confidence,sourceQuotes},
    relations: up to 40 {fromTempId,toTempId,type,sourceQuotes},
    stances: up to 24 {speakerLabel,targetTempId,position,rationale,confidence,sourceQuotes},
    facilitatorActions: up to 6 {type,label,prompt,rationale,urgency,priority,targetTempIds,sourceQuotes}
  }

Node kinds: issue, need, proposal, evidence, question, decision, action, experiment. Relation types: supports, challenges, responds_to, depends_on, tests, addresses, results_in. Stance positions: supports, challenges, qualifies, unclear. Action types: ask, clarify, compare, surface_tension, test, decide, confirm_owner, summarize. Action urgency: now, soon, watch.

Agreement is always about a specific proposal or decision and will be computed from target-specific stances; never return one global sentiment or consensus score. Prefer issues, user needs, concrete proposals, criteria evidence, disagreements, decisions, owners, and testable experiments over counts. Each transcript-derived statement and action must contain sourceQuotes. Each quote is {turnId,quote}, and quote must be an exact verbatim substring of that turn. Only cite supplied IDs. Keep uncertainty and minority positions visible. A visual caption is context, not proof. Facilitator actions are private recommendations until a human invokes them; phrase prompts as neutral questions or reflections, never commands.`,
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 5000,
        reasoning_effort: process.env.ANALYSIS_REASONING_EFFORT || "minimal",
      }),
    }, { operation: "full-analysis", timeoutMs: configuredTimeoutMs() });
    if (!response.ok) {
      throw new Error(`analysis provider returned ${response.status}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("analysis provider returned no content");
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeAnalysis(
  raw: unknown,
  turns: LiveAnalysisTurn[],
  config: LiveAnalysisConfig,
  engine: LiveAnalysisResult["engine"],
): LiveAnalysisResult {
  const fallback = fallbackAnalysis(turns, [], config);
  if (!isRecord(raw)) return fallback;
  const turnById = new Map(turns.map((turn) => [turn.id, turn]));
  const grounding: GroundingCounter = {
    validatedSourceCount: 0,
    rejectedSourceCount: 0,
  };
  let keyFindings = normalizeFindings(raw.keyFindings, turnById, grounding);
  const criteriaValues = Array.isArray(raw.criteria) ? raw.criteria : [];
  const criteria = config.criteria.map((criterion) => {
    const candidate = criteriaValues.find(
      (value) =>
        isRecord(value) &&
        typeof value.criterion === "string" &&
        value.criterion.trim().toLowerCase() === criterion.toLowerCase(),
    );
    if (!isRecord(candidate)) {
      return {
        criterion,
        status: "unaddressed" as const,
        text: "No source-linked coverage was returned for this criterion.",
        supportingTurnIds: [],
        sourceQuotes: [],
      };
    }
    const requestedStatus = ["unaddressed", "discussed", "evidenced"].includes(
      String(candidate.status),
    )
      ? (candidate.status as "unaddressed" | "discussed" | "evidenced")
      : "unaddressed";
    const sourceQuotes =
      requestedStatus === "unaddressed"
        ? []
        : normalizeSourceQuotes(candidate.sourceQuotes, turnById, grounding);
    const status: "unaddressed" | "discussed" | "evidenced" =
      requestedStatus === "unaddressed" || sourceQuotes.length === 0
        ? "unaddressed"
        : requestedStatus;
    return {
      criterion,
      status,
      text:
        status === "unaddressed" && requestedStatus !== "unaddressed"
          ? "The model supplied no exact transcript quote for this assessment."
          : boundedString(candidate.text, "", 360),
      supportingTurnIds: unique(sourceQuotes.map((source) => source.turnId)),
      sourceQuotes,
    };
  });
  let openQuestions = normalizeEvidence(
    raw.openQuestions,
    turnById,
    grounding,
  );
  let decisions = normalizeEvidence(raw.decisions, turnById, grounding);
  let actions = normalizeEvidence(raw.actions, turnById, grounding);

  const rawState = isRecord(raw.meetingState) ? raw.meetingState : null;
  let meetingState = rawState
    ? normalizeMeetingState(rawState, turns, config, grounding)
    : meetingStateFromLegacy(
        keyFindings,
        criteria,
        openQuestions,
        decisions,
        actions,
        turns,
        config,
      );

  const transcriptNodes = meetingState.nodes.filter(
    (node) => node.origin === "transcript",
  );
  if (keyFindings.length === 0 && transcriptNodes.length > 0) {
    keyFindings = transcriptNodes.slice(0, 6).map((node) => ({
      title: node.title,
      text: node.summary,
      supportingTurnIds: node.supportingTurnIds,
      sourceQuotes: node.sourceQuotes,
    }));
  }
  if (openQuestions.length === 0) {
    openQuestions = evidenceFromNodes(meetingState.nodes, "question");
  }
  if (decisions.length === 0) {
    decisions = evidenceFromNodes(meetingState.nodes, "decision");
  }
  if (actions.length === 0) {
    actions = evidenceFromNodes(meetingState.nodes, "action");
  }
  if (keyFindings.length === 0) {
    return {
      ...fallback,
      warning:
        "The model returned no semantic claims with exact transcript quotes; showing deterministic semantic coverage instead.",
    };
  }

  // Always rerank from the validated graph. Model suggestions can enrich the
  // dock, but cannot bypass source validation or stable action types.
  meetingState = {
    ...meetingState,
    facilitatorActions: rankFacilitatorActions(
      meetingState.nodes,
      meetingState.relations,
      meetingState.agreements,
      meetingState.facilitatorActions,
    ),
  };
  const groundedSummary = keyFindings
    .slice(0, 3)
    .map((finding) => finding.text)
    .join(" ");

  return {
    headline: boundedString(keyFindings[0].title, fallback.headline, 160),
    summary: boundedString(groundedSummary, fallback.summary, 900),
    keyFindings,
    criteria,
    openQuestions,
    decisions,
    actions,
    phaseAllocation: normalizePhaseAllocation(raw.phaseAllocation),
    agreementState: compatibilityAgreementState(meetingState.agreements),
    minorityPosition: firstMinorityPosition(meetingState),
    engine,
    grounding,
    meetingState,
  };
}

function fallbackAnalysis(
  turns: LiveAnalysisTurn[],
  visualEvidence: LiveAnalysisVisualContext[],
  config: LiveAnalysisConfig,
): LiveAnalysisResult {
  const first = turns[0];
  const last = turns.at(-1)!;
  const questionTurns = turns.filter((turn) => turn.text.includes("?")).slice(-4);
  const decisionTurns = turns
    .filter((turn) => /\b(decide|decided|agree|agreed|let us|let's|will test)\b/i.test(turn.text))
    .slice(-4);
  const actionTurns = turns
    .filter((turn) => /\b(i will|i'll|we will|we'll|action|next step)\b/i.test(turn.text))
    .slice(-4);
  const keyFindings = uniqueTurns([
    first,
    turns[Math.floor(turns.length / 2)],
    last,
  ]).map((turn, index) => ({
    title:
      index === 0
        ? "Opening context"
        : index === 1
          ? "Midpoint signal"
          : "Latest state",
    text: boundedString(turn.text, "", 320),
    supportingTurnIds: [turn.id],
    sourceQuotes: [sourceQuoteForTurn(turn)],
  }));
  const criteria = config.criteria.map((criterion) => {
    const words = criterion.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
    const matches = turns
      .filter((turn) => words.some((word) => turn.text.toLowerCase().includes(word)))
      .slice(-3);
    return {
      criterion,
      status: matches.length ? ("discussed" as const) : ("unaddressed" as const),
      text: matches.length
        ? "Related language appears in the source turns."
        : "No direct keyword coverage found in the transcript.",
      supportingTurnIds: matches.map((turn) => turn.id),
      sourceQuotes: matches.map((turn) => sourceQuoteForTurn(turn)),
    };
  });
  const openQuestions = questionTurns.map(toEvidence);
  const decisions = decisionTurns.map(toEvidence);
  const actions = actionTurns.map(toEvidence);
  const meetingState = deterministicMeetingState(turns, config);
  const validatedSourceCount = unique(
    meetingState.nodes.flatMap((node) => node.supportingTurnIds),
  ).length;

  return {
    headline: boundedString(
      `${humanizePhase(config.phase)} view · ${config.objective}`,
      "Live meeting synthesis",
      160,
    ),
    summary: `Analyzed all ${turns.length} substantive turns from ${first.speakerLabel} through ${last.speakerLabel}${
      visualEvidence.length
        ? `, together with ${visualEvidence.length} captured visual evidence ${visualEvidence.length === 1 ? "item" : "items"}`
        : ""
    }. This deterministic view preserves semantic coverage while model synthesis is unavailable.`,
    keyFindings,
    criteria,
    openQuestions,
    decisions,
    actions,
    phaseAllocation: {
      problemAndEvidence: 30,
      ideas: 25,
      evaluation: 30,
      decisionsAndActions: 15,
    },
    agreementState: compatibilityAgreementState(meetingState.agreements),
    minorityPosition: firstMinorityPosition(meetingState),
    engine: "deterministic-fallback",
    grounding: { validatedSourceCount, rejectedSourceCount: 0 },
    meetingState,
  };
}

function normalizeMeetingState(
  raw: Record<string, unknown>,
  turns: LiveAnalysisTurn[],
  config: LiveAnalysisConfig,
  grounding: GroundingCounter,
): MeetingState {
  const turnById = new Map(turns.map((turn) => [turn.id, turn]));
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes.filter(isRecord) : [];
  const tempToStable = new Map<string, string>();
  const nodes: MeetingStateNode[] = [];

  for (const candidate of rawNodes.slice(0, 32)) {
    if (!isOneOf(candidate.kind, NODE_KINDS)) continue;
    const kind = candidate.kind as MeetingNodeKind;
    const sourceQuotes = normalizeSourceQuotes(
      candidate.sourceQuotes,
      turnById,
      grounding,
    );
    if (sourceQuotes.length === 0) continue;
    const title = boundedString(candidate.title, humanizeKind(kind), 100);
    const stableId = stateId(
      "node",
      kind,
      sourceQuotes.map((source) => source.turnId).join("|"),
      title.toLowerCase(),
    );
    if (typeof candidate.tempId === "string") {
      tempToStable.set(candidate.tempId, stableId);
    }
    nodes.push({
      id: stableId,
      kind,
      title,
      summary: boundedString(candidate.summary, title, 420),
      status: isOneOf(candidate.status, NODE_STATUSES)
        ? (candidate.status as MeetingNodeStatus)
        : defaultStatus(kind),
      origin: "transcript",
      confidence: boundedNumber(candidate.confidence, 0.7, 0, 1),
      owner:
        typeof candidate.owner === "string"
          ? boundedString(candidate.owner, "", 80) || undefined
          : undefined,
      supportingTurnIds: unique(sourceQuotes.map((source) => source.turnId)),
      sourceQuotes,
    });
  }
  addCriterionNodes(nodes, config.criteria);
  const dedupedNodes = deduplicateNodes(nodes);
  const validNodeIds = new Set(dedupedNodes.map((node) => node.id));
  const relations = normalizeRelations(
    raw.relations,
    tempToStable,
    validNodeIds,
    turnById,
    grounding,
  );
  const stances = normalizeStances(
    raw.stances,
    tempToStable,
    validNodeIds,
    turnById,
    grounding,
  );
  const agreements = buildTargetAgreements(dedupedNodes, stances);
  const modelActions = normalizeActions(
    raw.facilitatorActions,
    tempToStable,
    validNodeIds,
    turnById,
    grounding,
  );
  return versionedState(
    dedupedNodes,
    relations,
    stances,
    agreements,
    modelActions,
    config,
  );
}

function deterministicMeetingState(
  turns: LiveAnalysisTurn[],
  config: LiveAnalysisConfig,
): MeetingState {
  const nodes: MeetingStateNode[] = [];
  const relations: MeetingStateRelation[] = [];
  const stances: MeetingStance[] = [];
  let lastTarget: MeetingStateNode | undefined;
  let lastProblem: MeetingStateNode | undefined;
  let lastProposal: MeetingStateNode | undefined;

  for (const turn of turns) {
    const kinds = deterministicKinds(turn.text);
    for (const kind of kinds) {
      const quote = sourceQuoteForTurn(turn);
      const node: MeetingStateNode = {
        id: stateId("node", kind, turn.id),
        kind,
        title: semanticTitle(kind, turn.text),
        summary: boundedString(turn.text, "", 420),
        status: defaultStatus(kind),
        origin: "transcript",
        confidence: 0.62,
        owner:
          kind === "action" && /\b(i will|i'll)\b/i.test(turn.text)
            ? turn.speakerLabel
            : undefined,
        supportingTurnIds: [turn.id],
        sourceQuotes: [quote],
      };
      nodes.push(node);

      if ((kind === "proposal" || kind === "decision") && lastProblem) {
        relations.push(inferredRelation(node, lastProblem, "addresses"));
      }
      if (kind === "experiment" && lastProposal) {
        relations.push(inferredRelation(node, lastProposal, "tests"));
      }
      if (kind === "action" && lastTarget) {
        relations.push(inferredRelation(lastTarget, node, "results_in"));
      }
      if (kind === "issue" || kind === "need") lastProblem = node;
      if (kind === "proposal") lastProposal = node;
      if (kind === "proposal" || kind === "decision") lastTarget = node;
    }

    const position = /\b(disagree|do not agree|don't agree|challenge|however|but)\b/i.test(
      turn.text,
    )
      ? "challenges"
      : /\b(agree|support|yes|that works)\b/i.test(turn.text)
        ? "supports"
        : /\b(if|provided|as long as|depends)\b/i.test(turn.text)
          ? "qualifies"
          : null;
    if (position && lastTarget) {
      const quote = sourceQuoteForTurn(turn);
      stances.push({
        id: stateId("stance", turn.id, lastTarget.id, position),
        speakerLabel: turn.speakerLabel,
        targetNodeId: lastTarget.id,
        position,
        rationale: boundedString(turn.text, "", 320),
        confidence: 0.65,
        supportingTurnIds: [turn.id],
        sourceQuotes: [quote],
      });
    }
  }
  addCriterionNodes(nodes, config.criteria);
  const dedupedNodes = deduplicateNodes(nodes);
  const agreements = buildTargetAgreements(dedupedNodes, stances);
  return versionedState(
    dedupedNodes,
    relations,
    stances,
    agreements,
    rankFacilitatorActions(dedupedNodes, relations, agreements, []),
    config,
  );
}

function meetingStateFromLegacy(
  findings: LiveAnalysisFinding[],
  criteria: LiveAnalysisResult["criteria"],
  questions: LiveAnalysisEvidence[],
  decisions: LiveAnalysisEvidence[],
  actions: LiveAnalysisEvidence[],
  turns: LiveAnalysisTurn[],
  config: LiveAnalysisConfig,
): MeetingState {
  const nodes: MeetingStateNode[] = [];
  for (const finding of findings) {
    nodes.push(nodeFromEvidence("evidence", finding.title, finding, "exploring"));
  }
  for (const question of questions) {
    nodes.push(nodeFromEvidence("question", "Open question", question, "open"));
  }
  for (const decision of decisions) {
    nodes.push(nodeFromEvidence("decision", "Decision", decision, "accepted"));
  }
  for (const action of actions) {
    nodes.push(nodeFromEvidence("action", "Action", action, "committed"));
  }
  for (const criterion of criteria) {
    nodes.push({
      id: stateId("criterion", criterion.criterion.toLowerCase()),
      kind: "criterion",
      title: criterion.criterion,
      summary: criterion.text,
      status: criterion.status === "unaddressed" ? "open" : "exploring",
      origin: "facilitator_intent",
      confidence: 1,
      supportingTurnIds: criterion.supportingTurnIds,
      sourceQuotes: criterion.sourceQuotes || [],
    });
  }
  const deterministic = deterministicMeetingState(turns, config);
  // Legacy responses are supplemented with locally detected proposals, needs,
  // targeted stances, and experiments so old model shapes do not regress UX.
  const mergedNodes = deduplicateNodes([...nodes, ...deterministic.nodes]);
  const agreements = buildTargetAgreements(mergedNodes, deterministic.stances);
  return versionedState(
    mergedNodes,
    deterministic.relations,
    deterministic.stances,
    agreements,
    deterministic.facilitatorActions,
    config,
  );
}

function normalizeRelations(
  value: unknown,
  tempToStable: Map<string, string>,
  validNodeIds: Set<string>,
  turnById: Map<string, LiveAnalysisTurn>,
  grounding: GroundingCounter,
): MeetingStateRelation[] {
  if (!Array.isArray(value)) return [];
  const relationTypes: MeetingStateRelation["type"][] = [
    "supports",
    "challenges",
    "responds_to",
    "depends_on",
    "tests",
    "addresses",
    "results_in",
  ];
  return value
    .filter(isRecord)
    .map((candidate) => {
      const fromNodeId = tempToStable.get(String(candidate.fromTempId)) || "";
      const toNodeId = tempToStable.get(String(candidate.toTempId)) || "";
      const sourceQuotes = normalizeSourceQuotes(
        candidate.sourceQuotes,
        turnById,
        grounding,
      );
      if (
        !validNodeIds.has(fromNodeId) ||
        !validNodeIds.has(toNodeId) ||
        !isOneOf(candidate.type, relationTypes) ||
        sourceQuotes.length === 0
      ) {
        return null;
      }
      return {
        id: stateId("relation", fromNodeId, toNodeId, candidate.type as string),
        fromNodeId,
        toNodeId,
        type: candidate.type as MeetingStateRelation["type"],
        supportingTurnIds: unique(sourceQuotes.map((source) => source.turnId)),
        sourceQuotes,
      };
    })
    .filter((value): value is MeetingStateRelation => Boolean(value))
    .slice(0, 40);
}

function normalizeStances(
  value: unknown,
  tempToStable: Map<string, string>,
  validNodeIds: Set<string>,
  turnById: Map<string, LiveAnalysisTurn>,
  grounding: GroundingCounter,
): MeetingStance[] {
  if (!Array.isArray(value)) return [];
  const positions: MeetingStance["position"][] = [
    "supports",
    "challenges",
    "qualifies",
    "unclear",
  ];
  return value
    .filter(isRecord)
    .map((candidate) => {
      const targetNodeId = tempToStable.get(String(candidate.targetTempId)) || "";
      const sourceQuotes = normalizeSourceQuotes(
        candidate.sourceQuotes,
        turnById,
        grounding,
      );
      const speakerLabel =
        typeof candidate.speakerLabel === "string"
          ? boundedString(candidate.speakerLabel, "", 80)
          : sourceQuotes[0]?.speakerLabel || "";
      if (
        !validNodeIds.has(targetNodeId) ||
        !speakerLabel ||
        !isOneOf(candidate.position, positions) ||
        sourceQuotes.length === 0
      ) {
        return null;
      }
      return {
        id: stateId(
          "stance",
          speakerLabel,
          targetNodeId,
          candidate.position as string,
        ),
        speakerLabel,
        targetNodeId,
        position: candidate.position as MeetingStance["position"],
        rationale: boundedString(candidate.rationale, sourceQuotes[0].quote, 320),
        confidence: boundedNumber(candidate.confidence, 0.7, 0, 1),
        supportingTurnIds: unique(sourceQuotes.map((source) => source.turnId)),
        sourceQuotes,
      };
    })
    .filter((value): value is MeetingStance => Boolean(value))
    .slice(0, 24);
}

function normalizeActions(
  value: unknown,
  tempToStable: Map<string, string>,
  validNodeIds: Set<string>,
  turnById: Map<string, LiveAnalysisTurn>,
  grounding: GroundingCounter,
): FacilitatorAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((candidate) => {
      const sourceQuotes = normalizeSourceQuotes(
        candidate.sourceQuotes,
        turnById,
        grounding,
      );
      const targetNodeIds = Array.isArray(candidate.targetTempIds)
        ? unique(
            candidate.targetTempIds
              .map((id) => tempToStable.get(String(id)) || "")
              .filter((id) => validNodeIds.has(id)),
          )
        : [];
      if (
        !isOneOf(candidate.type, ACTION_TYPES) ||
        sourceQuotes.length === 0 ||
        targetNodeIds.length === 0
      ) {
        return null;
      }
      const prompt = boundedString(candidate.prompt, "", 280);
      if (!prompt) return null;
      const urgency = ["now", "soon", "watch"].includes(String(candidate.urgency))
        ? (candidate.urgency as FacilitatorAction["urgency"])
        : "soon";
      return {
        id: stateId("action", candidate.type as string, targetNodeIds.join("|"), prompt),
        type: candidate.type as FacilitatorActionType,
        label: boundedString(candidate.label, humanizeKind(candidate.type as string), 72),
        prompt,
        rationale: boundedString(candidate.rationale, "Grounded in the live discussion.", 240),
        urgency,
        priority: boundedNumber(candidate.priority, urgency === "now" ? 0.85 : 0.65, 0, 1),
        targetNodeIds,
        supportingTurnIds: unique(sourceQuotes.map((source) => source.turnId)),
        sourceQuotes,
        requiresApproval: true as const,
      };
    })
    .filter((value): value is FacilitatorAction => Boolean(value))
    .slice(0, 6);
}

function buildTargetAgreements(
  nodes: MeetingStateNode[],
  stances: MeetingStance[],
): TargetAgreement[] {
  return nodes
    .filter((node) => node.kind === "proposal" || node.kind === "decision")
    .map((node) => {
      const targeted = stances.filter((stance) => stance.targetNodeId === node.id);
      const author = node.sourceQuotes[0]?.speakerLabel;
      const supporters = unique([
        ...(author ? [author] : []),
        ...targeted
          .filter((stance) => stance.position === "supports")
          .map((stance) => stance.speakerLabel),
      ]);
      const challengers = unique(
        targeted
          .filter((stance) => stance.position === "challenges")
          .map((stance) => stance.speakerLabel),
      );
      const state: TargetAgreement["state"] =
        challengers.length > 0 && supporters.length > 0
          ? supporters.length === challengers.length
            ? "divided"
            : "contested"
          : challengers.length > 0
            ? "contested"
            : supporters.length >= 3
              ? "consensus"
              : supporters.length >= 2
                ? "majority"
                : "emerging";
      const sources = deduplicateQuotes([
        ...node.sourceQuotes,
        ...targeted.flatMap((stance) => stance.sourceQuotes),
      ]);
      return {
        targetNodeId: node.id,
        state,
        summary:
          state === "divided" || state === "contested"
            ? `${supporters.length} speaker${supporters.length === 1 ? "" : "s"} support and ${challengers.length} challenge this specific ${node.kind}.`
            : state === "emerging"
              ? `This ${node.kind} has been voiced but not yet explicitly checked with the group.`
              : `${supporters.length} speakers explicitly support this ${node.kind}.`,
        supportingSpeakers: supporters,
        challengingSpeakers: challengers,
        supportingTurnIds: unique(sources.map((source) => source.turnId)),
        sourceQuotes: sources,
      };
    });
}

function rankFacilitatorActions(
  nodes: MeetingStateNode[],
  relations: MeetingStateRelation[],
  agreements: TargetAgreement[],
  modelActions: FacilitatorAction[],
): FacilitatorAction[] {
  const candidates = [...modelActions];
  const add = (
    type: FacilitatorActionType,
    target: MeetingStateNode,
    label: string,
    prompt: string,
    rationale: string,
    priority: number,
    urgency: FacilitatorAction["urgency"],
  ) => {
    if (target.sourceQuotes.length === 0) return;
    candidates.push({
      id: stateId("action", type, target.id, prompt),
      type,
      label,
      prompt,
      rationale,
      urgency,
      priority,
      targetNodeIds: [target.id],
      supportingTurnIds: target.supportingTurnIds,
      sourceQuotes: target.sourceQuotes,
      requiresApproval: true,
    });
  };

  for (const agreement of agreements) {
    const target = nodes.find((node) => node.id === agreement.targetNodeId);
    if (!target) continue;
    if (agreement.state === "divided" || agreement.state === "contested") {
      add(
        "surface_tension",
        target,
        "Name the trade-off",
        `I’m hearing different positions on “${target.title}.” What evidence or criterion would help us choose?`,
        "A target-specific challenge is present and should remain visible before convergence.",
        0.96,
        "now",
      );
    } else if (agreement.state === "emerging" && target.kind === "decision") {
      add(
        "decide",
        target,
        "Check the decision",
        `Should “${target.title}” be recorded as a group decision, or is it still a proposal?`,
        "The transcript contains decision language without enough explicit support to claim consensus.",
        0.88,
        "now",
      );
    }
  }

  for (const question of nodes.filter((node) => node.kind === "question")) {
    add(
      "ask",
      question,
      "Reopen a question",
      question.summary.endsWith("?") ? question.summary : `${question.summary}?`,
      "The question remains open in the meeting map.",
      0.8,
      "soon",
    );
  }
  for (const proposal of nodes.filter((node) => node.kind === "proposal")) {
    const hasTest = relations.some(
      (relation) => relation.toNodeId === proposal.id && relation.type === "tests",
    );
    if (!hasTest) {
      add(
        "test",
        proposal,
        "Make it testable",
        `What is the smallest observation or experiment that would distinguish whether “${proposal.title}” works?`,
        "A concrete proposal is present without a linked experiment.",
        0.76,
        "soon",
      );
    }
  }
  for (const action of nodes.filter((node) => node.kind === "action" && !node.owner)) {
    add(
      "confirm_owner",
      action,
      "Confirm ownership",
      `Who will own “${action.title},” and when will the group revisit it?`,
      "A next step is visible but no owner is grounded in the transcript.",
      0.84,
      "now",
    );
  }
  for (const need of nodes.filter((node) => node.kind === "need")) {
    const addressed = relations.some(
      (relation) => relation.toNodeId === need.id && relation.type === "addresses",
    );
    if (!addressed) {
      add(
        "compare",
        need,
        "Connect need to options",
        `Which current proposal best addresses “${need.title},” and what remains uncovered?`,
        "A user need is visible without a linked proposal.",
        0.72,
        "watch",
      );
    }
  }

  const byId = new Map<string, FacilitatorAction>();
  for (const candidate of candidates) {
    const existing = byId.get(candidate.id);
    if (!existing || candidate.priority > existing.priority) {
      byId.set(candidate.id, candidate);
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
}

function versionedState(
  nodes: MeetingStateNode[],
  relations: MeetingStateRelation[],
  stances: MeetingStance[],
  agreements: TargetAgreement[],
  facilitatorActions: FacilitatorAction[],
  config: LiveAnalysisConfig,
): MeetingState {
  const previousNodes = new Map(
    config.previousState?.nodes.map((node) => [node.id, node]) || [],
  );
  const previousIds = new Set(previousNodes.keys());
  const currentIds = new Set(nodes.map((node) => node.id));
  return {
    schemaVersion: 1,
    revision: (config.previousState?.revision || 0) + 1,
    previousSnapshotId: config.previousSnapshotId,
    nodes,
    relations,
    stances,
    agreements,
    facilitatorActions,
    changes: {
      addedNodeIds: nodes
        .filter((node) => !previousIds.has(node.id))
        .map((node) => node.id),
      retainedNodeIds: nodes
        .filter((node) => previousIds.has(node.id))
        .map((node) => node.id),
      strengthenedNodeIds: nodes
        .filter((node) => {
          const previous = previousNodes.get(node.id);
          if (!previous) return false;
          return (
            node.supportingTurnIds.length > previous.supportingTurnIds.length ||
            node.sourceQuotes.length > previous.sourceQuotes.length
          );
        })
        .map((node) => node.id),
      promotedNodeIds: nodes
        .filter((node) => {
          const previous = previousNodes.get(node.id);
          return previous && nodeMaturityRank(node) > nodeMaturityRank(previous);
        })
        .map((node) => node.id),
      fadedNodeIds: nodes
        .filter((node) => {
          const previous = previousNodes.get(node.id);
          return (
            previous &&
            previous.status !== "rejected" &&
            node.status === "rejected"
          );
        })
        .map((node) => node.id),
      removedNodeIds: [...previousIds].filter((id) => !currentIds.has(id)),
    },
  };
}

function nodeMaturityRank(node: MeetingStateNode) {
  if (["accepted", "committed", "done"].includes(node.status)) return 3;
  if (node.sourceQuotes.length > 0) return 2;
  return 1;
}

function addCriterionNodes(nodes: MeetingStateNode[], criteria: string[]) {
  for (const criterion of criteria) {
    nodes.push({
      id: stateId("criterion", criterion.toLowerCase()),
      kind: "criterion",
      title: criterion,
      summary: "Facilitator-defined criterion for evaluating proposals and evidence.",
      status: "open",
      origin: "facilitator_intent",
      confidence: 1,
      supportingTurnIds: [],
      sourceQuotes: [],
    });
  }
}

function deterministicKinds(text: string): MeetingNodeKind[] {
  const kinds: MeetingNodeKind[] = [];
  const matches = (pattern: RegExp) => pattern.test(text);
  if (matches(/\b(study|research|observed|observation|data|evidence|notes?|showed|learned|measured)\b/i)) kinds.push("evidence");
  if (matches(/\b(problem|issue|risk|concern|failure|fails?|missing|gap|cannot|can't|unclear)\b/i)) kinds.push("issue");
  if (matches(/\b(users?|people|residents?|customers?|participants?)\b.*\b(need|must|expect|struggle|cannot|can't|want)\b/i) || matches(/\bneed\b/i)) kinds.push("need");
  if (text.includes("?")) kinds.push("question");
  if (matches(/\b(propose|suggest|could|should|what if|idea|option|alternative|we can)\b/i)) kinds.push("proposal");
  if (matches(/\b(decide|decided|agreed|let us|let's|we choose|decision)\b/i)) kinds.push("decision");
  if (matches(/\b(i will|i'll|we will|we'll|next step|action|schedule|bring)\b/i)) kinds.push("action");
  if (matches(/\b(test|prototype|experiment|pilot|compare|trial|measure)\b/i)) kinds.push("experiment");
  return unique(kinds).slice(0, 3);
}

function inferredRelation(
  from: MeetingStateNode,
  to: MeetingStateNode,
  type: MeetingStateRelation["type"],
): MeetingStateRelation {
  const sourceQuotes = deduplicateQuotes([...from.sourceQuotes, ...to.sourceQuotes]);
  return {
    id: stateId("relation", from.id, to.id, type),
    fromNodeId: from.id,
    toNodeId: to.id,
    type,
    supportingTurnIds: unique(sourceQuotes.map((source) => source.turnId)),
    sourceQuotes,
  };
}

function nodeFromEvidence(
  kind: MeetingNodeKind,
  title: string,
  evidence: LiveAnalysisEvidence,
  status: MeetingNodeStatus,
): MeetingStateNode {
  return {
    id: stateId("node", kind, evidence.supportingTurnIds.join("|"), title),
    kind,
    title,
    summary: evidence.text,
    status,
    origin: "transcript",
    confidence: 0.72,
    supportingTurnIds: evidence.supportingTurnIds,
    sourceQuotes: evidence.sourceQuotes || [],
  };
}

function normalizeFindings(
  value: unknown,
  turnById: Map<string, LiveAnalysisTurn>,
  grounding: GroundingCounter,
): LiveAnalysisFinding[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => {
      const sourceQuotes = normalizeSourceQuotes(item.sourceQuotes, turnById, grounding);
      return {
        title: boundedString(item.title, "Finding", 100),
        text: boundedString(item.text, "", 420),
        supportingTurnIds: unique(sourceQuotes.map((source) => source.turnId)),
        sourceQuotes,
      };
    })
    .filter((item) => item.text.length > 0 && item.supportingTurnIds.length > 0)
    .slice(0, 6);
}

function normalizeEvidence(
  value: unknown,
  turnById: Map<string, LiveAnalysisTurn>,
  grounding: GroundingCounter,
): LiveAnalysisEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => {
      const sourceQuotes = normalizeSourceQuotes(item.sourceQuotes, turnById, grounding);
      return {
        text: boundedString(item.text, "", 360),
        supportingTurnIds: unique(sourceQuotes.map((source) => source.turnId)),
        sourceQuotes,
      };
    })
    .filter((item) => item.text.length > 0 && item.sourceQuotes.length > 0)
    .slice(0, 8);
}

function normalizeSourceQuotes(
  value: unknown,
  turnById: Map<string, LiveAnalysisTurn>,
  grounding: GroundingCounter,
): LiveAnalysisSourceQuote[] {
  if (!Array.isArray(value)) return [];
  const sourceQuotes: LiveAnalysisSourceQuote[] = [];
  for (const source of value.slice(0, 16)) {
    if (!isRecord(source)) {
      grounding.rejectedSourceCount++;
      continue;
    }
    const turnId = typeof source.turnId === "string" ? source.turnId : "";
    const quote = typeof source.quote === "string" ? source.quote.trim() : "";
    const turn = turnById.get(turnId);
    if (!turn || !quote || !turn.text.includes(quote)) {
      grounding.rejectedSourceCount++;
      continue;
    }
    if (sourceQuotes.some((item) => item.turnId === turnId && item.quote === quote)) {
      continue;
    }
    sourceQuotes.push(sourceQuoteForTurn(turn, quote));
    grounding.validatedSourceCount++;
  }
  return sourceQuotes.slice(0, 12);
}

function serializeTurn(turn: LiveAnalysisTurn) {
  return {
    id: turn.id,
    speaker: turn.speakerLabel,
    text: turn.text,
    startMs: turn.startMs,
    endMs: turn.endMs,
    transcriptConfidence: turn.transcriptConfidence,
    uncertainty: sourceUncertainty(turn),
  };
}

function sourceQuoteForTurn(
  turn: LiveAnalysisTurn,
  quote = boundedString(turn.text, "", 280),
): LiveAnalysisSourceQuote {
  return {
    turnId: turn.id,
    quote,
    speakerLabel: turn.speakerLabel,
    startMs: turn.startMs,
    endMs: turn.endMs,
    transcriptConfidence: turn.transcriptConfidence,
    uncertainty: sourceUncertainty(turn),
  };
}

function sourceUncertainty(turn: LiveAnalysisTurn) {
  const uncertainty: NonNullable<LiveAnalysisSourceQuote["uncertainty"]> = [];
  if (turn.isUnknownSpeaker) uncertainty.push("unknown_speaker");
  if (turn.possibleOverlap) uncertainty.push("possible_overlap");
  if (turn.wasSpeakerRevised) uncertainty.push("speaker_revised");
  if (turn.isManuallyCorrected) uncertainty.push("text_corrected");
  return uncertainty;
}

function toEvidence(turn: LiveAnalysisTurn): LiveAnalysisEvidence {
  return {
    text: boundedString(turn.text, "", 360),
    supportingTurnIds: [turn.id],
    sourceQuotes: [sourceQuoteForTurn(turn)],
  };
}

function evidenceFromNodes(nodes: MeetingStateNode[], kind: MeetingNodeKind) {
  return nodes
    .filter((node) => node.kind === kind)
    .slice(0, 8)
    .map((node) => ({
      text: node.summary,
      supportingTurnIds: node.supportingTurnIds,
      sourceQuotes: node.sourceQuotes,
    }));
}

function deduplicateNodes(nodes: MeetingStateNode[]) {
  const byId = new Map<string, MeetingStateNode>();
  for (const node of nodes) {
    const existing = byId.get(node.id);
    if (!existing || node.confidence > existing.confidence) byId.set(node.id, node);
  }
  return [...byId.values()].slice(0, 40);
}

function deduplicateQuotes(quotes: LiveAnalysisSourceQuote[]) {
  const seen = new Set<string>();
  return quotes.filter((source) => {
    const key = `${source.turnId}\u0000${source.quote}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function semanticTitle(kind: MeetingNodeKind, text: string) {
  const prefix = humanizeKind(kind);
  const clean = text.replace(/\s+/g, " ").trim();
  const firstClause = clean.split(/[.!?;]|\b(?:because|so that)\b/i)[0];
  return boundedString(firstClause, prefix, 88);
}

function defaultStatus(kind: MeetingNodeKind): MeetingNodeStatus {
  if (kind === "proposal") return "proposed";
  if (kind === "decision") return "accepted";
  if (kind === "action" || kind === "experiment") return "committed";
  return "open";
}

function compatibilityAgreementState(
  agreements: TargetAgreement[],
): LiveAnalysisResult["agreementState"] {
  if (agreements.some((agreement) => agreement.state === "divided" || agreement.state === "contested")) return "divided";
  if (agreements.some((agreement) => agreement.state === "consensus")) return "consensus";
  if (agreements.some((agreement) => agreement.state === "majority")) return "majority";
  return "emerging";
}

function firstMinorityPosition(state: MeetingState) {
  const contested = state.agreements.find(
    (agreement) => agreement.challengingSpeakers.length > 0,
  );
  if (!contested) return undefined;
  const target = state.nodes.find((node) => node.id === contested.targetNodeId);
  return target
    ? `${contested.challengingSpeakers.join(", ")} challenged “${target.title}”.`
    : undefined;
}

function compactPreviousState(previous?: MeetingState) {
  if (!previous) return undefined;
  return {
    revision: previous.revision,
    nodes: previous.nodes.map(({ id, kind, title, status, supportingTurnIds }) => ({
      id,
      kind,
      title,
      status,
      supportingTurnIds,
    })),
  };
}

function normalizePhaseAllocation(value: unknown) {
  const phase = isRecord(value) ? value : {};
  const raw = [
    boundedNumber(phase.problemAndEvidence, 30, 0, 100),
    boundedNumber(phase.ideas, 25, 0, 100),
    boundedNumber(phase.evaluation, 30, 0, 100),
    boundedNumber(phase.decisionsAndActions, 15, 0, 100),
  ];
  const total = raw.reduce((sum, current) => sum + current, 0) || 100;
  const normalized = raw.map((current) => Math.round((current / total) * 100));
  normalized[3] += 100 - normalized.reduce((sum, current) => sum + current, 0);
  return {
    problemAndEvidence: normalized[0],
    ideas: normalized[1],
    evaluation: normalized[2],
    decisionsAndActions: normalized[3],
  };
}

function configuredTimeoutMs() {
  const configured = Number(process.env.ANALYSIS_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1_000
    ? Math.min(configured, 120_000)
    : DEFAULT_TIMEOUT_MS;
}

function boundedString(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const text = value.trim();
  if (text.length <= maxLength) return text;
  const candidate = text.slice(0, Math.max(1, maxLength - 1));
  const breakAt = candidate.lastIndexOf(" ");
  const end = breakAt >= Math.floor(maxLength * 0.65) ? breakAt : candidate.length;
  return `${candidate.slice(0, end)}…`;
}

function boundedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

function stateId(...parts: string[]) {
  const input = parts.join("\u001f");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${parts[0]}-${(hash >>> 0).toString(36)}`;
}

function humanizePhase(phase: string) {
  return phase.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function humanizeKind(kind: string) {
  return kind.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueTurns(turns: LiveAnalysisTurn[]) {
  return turns.filter(
    (turn, index) => turns.findIndex((candidate) => candidate.id === turn.id) === index,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}
