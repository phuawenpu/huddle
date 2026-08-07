import type {
  CritiqueIntelligenceSnapshot,
  CritiqueSignal,
  CritiqueSignalKind,
  CritiqueTrace,
  DiscussionCategory,
  EvidenceBasis,
  TranscriptTurnData,
  TurnAnalysis,
} from "./types";

const SIGNAL_KINDS: CritiqueSignalKind[] = [
  "observation",
  "evidence",
  "question",
  "concern",
  "position",
  "alternative",
  "constraint",
  "decision",
  "action",
  "reference",
];

const CATEGORIES: DiscussionCategory[] = [
  "evidence",
  "questions",
  "positions",
  "decisions",
  "actions",
  "themes",
];

const EVIDENCE_BASES: EvidenceBasis[] = [
  "direct_observation",
  "reported_evidence",
  "inference",
  "none",
];

const MAX_SIGNALS_PER_TURN = 3;
const MAX_SUMMARY_LENGTH = 180;
const MAX_TARGET_LENGTH = 100;
const MAX_TRACE_ITEMS = 6;

type UnknownRecord = Record<string, unknown>;

/**
 * Convert untrusted model output into the bounded critique contract used by the
 * product. Quotes must be exact transcript substrings and criteria must match
 * the facilitator-authored list; invented anchors are discarded.
 */
export function normalizeTurnAnalysis(
  raw: unknown,
  turnText: string,
  criteria: string[],
): TurnAnalysis {
  const value = isRecord(raw) ? raw : {};
  const category = isOneOf(value.category, CATEGORIES)
    ? value.category
    : inferCategory(turnText);
  const confidence = clampNumber(value.confidence, 0.5);
  const rawSignals = Array.isArray(value.signals) ? value.signals : [];

  const signals = rawSignals
    .slice(0, MAX_SIGNALS_PER_TURN)
    .map((signal) => normalizeSignal(signal, turnText, criteria, confidence))
    .filter((signal): signal is CritiqueSignal => signal !== null);

  if (signals.length === 0 && turnText.trim()) {
    signals.push(deriveSignal(turnText, category, criteria, confidence));
  }

  const targetCriteria = unique(
    signals
      .map((signal) => signal.criterion)
      .filter((criterion): criterion is string => Boolean(criterion)),
  );

  return {
    category,
    confidence,
    evidence: cleanOptional(value.evidence, MAX_SUMMARY_LENGTH),
    rationale: cleanOptional(value.rationale, MAX_SUMMARY_LENGTH),
    intent: cleanOptional(value.intent, MAX_SUMMARY_LENGTH),
    stance: cleanOptional(value.stance, 40),
    theme: cleanOptional(value.theme, MAX_SUMMARY_LENGTH),
    signals,
    targetCriteria,
  };
}

export function buildCritiqueIntelligence(
  turns: TranscriptTurnData[],
  criteria: string[],
): CritiqueIntelligenceSnapshot {
  const signalCounts = Object.fromEntries(
    SIGNAL_KINDS.map((kind) => [kind, 0]),
  ) as Record<CritiqueSignalKind, number>;

  const coverage = criteria.map((criterion) => ({
    criterion,
    discussed: 0,
    evidenced: 0,
    turnIds: new Set<string>(),
  }));
  const openLoops: CritiqueTrace[] = [];
  const alternatives: CritiqueTrace[] = [];
  const decisions: CritiqueTrace[] = [];
  const actions: CritiqueTrace[] = [];
  const evidenceGaps: CritiqueTrace[] = [];

  const analyzedTurns = turns.filter(
    (turn) => turn.isFinal && turn.isSubstantive && turn.analysis,
  );

  for (const turn of analyzedTurns) {
    const signals = turn.analysis?.signals ?? [];
    for (const signal of signals) {
      signalCounts[signal.kind] += 1;
      const trace = toTrace(turn, signal);

      if (signal.kind === "question" || signal.kind === "concern") {
        addUniqueTrace(openLoops, trace);
      }
      if (signal.kind === "alternative") addUniqueTrace(alternatives, trace);
      if (signal.kind === "decision") addUniqueTrace(decisions, trace);
      if (signal.kind === "action") addUniqueTrace(actions, trace);
      if (
        ["position", "concern", "alternative", "decision"].includes(
          signal.kind,
        ) &&
        (signal.evidenceBasis === "none" ||
          signal.evidenceBasis === "inference")
      ) {
        addUniqueTrace(evidenceGaps, trace);
      }

      for (const item of coverage) {
        if (
          signal.criterion === item.criterion ||
          mentionsCriterion(
            `${signal.summary} ${signal.target ?? ""} ${turn.currentText}`,
            item.criterion,
          )
        ) {
          item.discussed += 1;
          item.turnIds.add(turn.id);
          if (
            signal.kind === "evidence" ||
            signal.kind === "observation" ||
            signal.evidenceBasis === "direct_observation" ||
            signal.evidenceBasis === "reported_evidence"
          ) {
            item.evidenced += 1;
          }
        }
      }
    }
  }

  return {
    analyzedTurnCount: analyzedTurns.length,
    lastUpdatedAtMs: analyzedTurns.reduce<number | null>((latest, turn) => {
      if (turn.analysisReceivedAtMs == null) return latest;
      return latest == null
        ? turn.analysisReceivedAtMs
        : Math.max(latest, turn.analysisReceivedAtMs);
    }, null),
    signalCounts,
    criteriaCoverage: coverage.map((item) => ({
      criterion: item.criterion,
      status:
        item.evidenced > 0
          ? "evidenced"
          : item.discussed > 0
            ? "discussed"
            : "unaddressed",
      signalCount: item.discussed,
      sourceTurnIds: [...item.turnIds],
    })),
    openLoops: openLoops.slice(0, MAX_TRACE_ITEMS),
    alternatives: alternatives.slice(0, MAX_TRACE_ITEMS),
    decisions: decisions.slice(0, MAX_TRACE_ITEMS),
    actions: actions.slice(0, MAX_TRACE_ITEMS),
    evidenceGaps: evidenceGaps.slice(0, MAX_TRACE_ITEMS),
  };
}

export function discussionItemsForAnalysis(
  turnId: string,
  analysis: TurnAnalysis,
  fallbackText: string,
): Array<{
  category: DiscussionCategory;
  text: string;
  turnIds: string[];
}> {
  const items = (analysis.signals ?? []).map((signal) => ({
    category: categoryForSignal(signal.kind),
    text: truncate(signal.summary || signal.sourceQuote, 140),
    turnIds: [turnId],
  }));

  if (items.length > 0) return deduplicateItems(items);

  return [
    {
      category: analysis.category,
      text: truncate(
        analysis.evidence || analysis.rationale || fallbackText,
        140,
      ),
      turnIds: [turnId],
    },
  ];
}

function normalizeSignal(
  raw: unknown,
  turnText: string,
  criteria: string[],
  fallbackConfidence: number,
): CritiqueSignal | null {
  if (!isRecord(raw) || !isOneOf(raw.kind, SIGNAL_KINDS)) return null;
  const sourceQuote = exactSourceQuote(raw.sourceQuote, turnText);
  if (!sourceQuote) return null;

  const criterion = matchCriterion(raw.criterion, criteria);
  const basis = isOneOf(raw.evidenceBasis, EVIDENCE_BASES)
    ? raw.evidenceBasis
    : inferEvidenceBasis(raw.kind, turnText);
  const stance = isOneOf(raw.stance, [
    "supports",
    "challenges",
    "qualifies",
    "neutral",
  ] as const)
    ? raw.stance
    : undefined;

  return {
    kind: raw.kind,
    summary:
      cleanOptional(raw.summary, MAX_SUMMARY_LENGTH) ??
      truncate(sourceQuote, MAX_SUMMARY_LENGTH),
    sourceQuote,
    target: cleanOptional(raw.target, MAX_TARGET_LENGTH),
    criterion,
    stance,
    evidenceBasis: basis,
    confidence: clampNumber(raw.confidence, fallbackConfidence),
  };
}

function deriveSignal(
  turnText: string,
  category: DiscussionCategory,
  criteria: string[],
  confidence: number,
): CritiqueSignal {
  const kind = inferSignalKind(turnText, category);
  const criterion = criteria.find((candidate) =>
    mentionsCriterion(turnText, candidate),
  );
  return {
    kind,
    summary: truncate(cleanText(turnText), MAX_SUMMARY_LENGTH),
    sourceQuote: truncate(cleanText(turnText), MAX_SUMMARY_LENGTH),
    criterion,
    evidenceBasis: inferEvidenceBasis(kind, turnText),
    confidence,
  };
}

function inferSignalKind(
  text: string,
  category: DiscussionCategory,
): CritiqueSignalKind {
  const lower = text.toLowerCase();
  if (
    /\b(i(?:'ll| will)|we(?:'ll| will)|action|next step|follow up|prototype|test by)\b/.test(
      lower,
    )
  ) {
    return "action";
  }
  if (
    /\b(decided|we agree|agreed|settled|decision|we(?:'ll| will) use|converging)\b/.test(
      lower,
    )
  ) {
    return "decision";
  }
  if (
    /\b(alternative|instead|another approach|what if|could (?:we )?(?:use|try|replace)|could also|different direction)\b/.test(
      lower,
    )
  ) {
    return "alternative";
  }
  if (
    text.includes("?") ||
    /^(why|how|what|where|when|who|could|should|can)\b/i.test(text.trim())
  ) {
    return "question";
  }
  if (
    /\b(constraint|must|cannot|can't|budget|deadline|requirement|accessible|privacy)\b/.test(
      lower,
    )
  ) {
    return "constraint";
  }
  if (
    /\b(worried|concern|risk|problem|fails?|unclear|confusing|doesn't|does not)\b/.test(
      lower,
    )
  ) {
    return "concern";
  }
  if (
    /\b(data|research|interview|observed|usability|study|test showed|evidence|metric)\b/.test(
      lower,
    )
  ) {
    return "evidence";
  }
  if (
    /\b(i see|i notice|looking at|the (screen|model|drawing|flow|prototype))\b/.test(
      lower,
    )
  ) {
    return "observation";
  }

  const byCategory: Record<DiscussionCategory, CritiqueSignalKind> = {
    evidence: "evidence",
    questions: "question",
    positions: "position",
    decisions: "decision",
    actions: "action",
    themes: "position",
  };
  return byCategory[category];
}

function inferCategory(text: string): DiscussionCategory {
  const kind = inferSignalKind(text, "themes");
  return categoryForSignal(kind);
}

function inferEvidenceBasis(
  kind: CritiqueSignalKind,
  text: string,
): EvidenceBasis {
  const lower = text.toLowerCase();
  if (
    /\b(data|research|interview|study|metric|analytics|participants? (said|did)|users? (said|did)|(?:in|from|during) (?:the )?(?:usability )?test|test(?:ing)? (?:showed|found|revealed))\b/.test(
      lower,
    )
  ) {
    return "reported_evidence";
  }
  if (
    kind === "observation" ||
    /\b(i see|i notice|looking at|in the (screen|model|drawing|prototype))\b/.test(
      lower,
    )
  ) {
    return "direct_observation";
  }
  if (["position", "concern", "alternative", "decision"].includes(kind)) {
    return "inference";
  }
  return "none";
}

function categoryForSignal(kind: CritiqueSignalKind): DiscussionCategory {
  if (kind === "observation" || kind === "evidence" || kind === "constraint") {
    return "evidence";
  }
  if (kind === "question" || kind === "concern") return "questions";
  if (kind === "position" || kind === "alternative") return "positions";
  if (kind === "decision") return "decisions";
  if (kind === "action") return "actions";
  return "themes";
}

function toTrace(
  turn: TranscriptTurnData,
  signal: CritiqueSignal,
): CritiqueTrace {
  return {
    turnId: turn.id,
    speakerLabel: turn.providerSpeakerLabel,
    summary: signal.summary,
    sourceQuote: signal.sourceQuote,
    criterion: signal.criterion,
  };
}

function addUniqueTrace(target: CritiqueTrace[], trace: CritiqueTrace): void {
  if (
    target.some(
      (item) =>
        item.turnId === trace.turnId &&
        item.summary.toLowerCase() === trace.summary.toLowerCase(),
    )
  ) {
    return;
  }
  target.push(trace);
}

function mentionsCriterion(text: string, criterion: string): boolean {
  const haystack = normalizedWords(text);
  const words = normalizedWords(criterion).filter((word) => word.length >= 4);
  if (
    words.some((word) => word.startsWith("accessib")) &&
    /\b(screen reader|screen-reader|keyboard|contrast|captions?)\b/i.test(text)
  ) {
    return true;
  }
  if (words.length === 0) {
    return cleanText(text)
      .toLowerCase()
      .includes(cleanText(criterion).toLowerCase());
  }
  const matches = words.filter((word) =>
    haystack.some(
      (candidate) =>
        candidate === word ||
        (candidate.length >= 5 &&
          word.length >= 5 &&
          candidate.slice(0, 5) === word.slice(0, 5)),
    ),
  ).length;
  return matches >= Math.min(2, words.length);
}

function matchCriterion(raw: unknown, criteria: string[]): string | undefined {
  if (typeof raw !== "string") return undefined;
  const normalized = cleanText(raw).toLowerCase();
  return criteria.find(
    (criterion) => cleanText(criterion).toLowerCase() === normalized,
  );
}

function exactSourceQuote(raw: unknown, turnText: string): string | null {
  if (typeof raw !== "string") return null;
  const candidate = cleanText(raw);
  if (!candidate) return null;
  const index = turnText.toLowerCase().indexOf(candidate.toLowerCase());
  if (index < 0) return null;
  return turnText.slice(index, index + candidate.length);
}

function clampNumber(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.max(0, Math.min(1, raw));
}

function cleanOptional(raw: unknown, maxLength: number): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = truncate(cleanText(raw), maxLength);
  return value || undefined;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizedWords(value: string): string[] {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) =>
      word.length > 5 && word.endsWith("s") ? word.slice(0, -1) : word,
    )
    .filter(Boolean);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function deduplicateItems<T extends { category: string; text: string }>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.category}:${item.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
