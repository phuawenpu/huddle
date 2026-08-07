import { describe, expect, it } from "vitest";
import {
  buildCritiqueIntelligence,
  discussionItemsForAnalysis,
  normalizeTurnAnalysis,
} from "../src/lib/critique-intelligence";
import type {
  CritiqueSignal,
  TranscriptTurnData,
  TurnAnalysis,
} from "../src/lib/types";

const CRITERIA = [
  "clear recovery state",
  "privacy in shared settings",
  "accessible interaction",
];

describe("critique intelligence contract", () => {
  it("keeps exact source anchors and facilitator-authored criteria", () => {
    const text =
      "In the usability test, three participants missed the recovery message.";
    const result = normalizeTurnAnalysis(
      {
        category: "evidence",
        confidence: 1.4,
        signals: [
          {
            kind: "evidence",
            summary: "Participants missed the recovery message",
            sourceQuote: "three participants missed the recovery message",
            criterion: "clear recovery state",
            evidenceBasis: "reported_evidence",
            confidence: 0.91,
          },
        ],
      },
      text,
      CRITERIA,
    );

    expect(result.confidence).toBe(1);
    expect(result.signals).toEqual([
      expect.objectContaining({
        kind: "evidence",
        sourceQuote: "three participants missed the recovery message",
        criterion: "clear recovery state",
        evidenceBasis: "reported_evidence",
      }),
    ]);
    expect(result.targetCriteria).toEqual(["clear recovery state"]);
  });

  it("discards hallucinated anchors and criteria, then derives a safe fallback", () => {
    const text = "I am worried the handoff is unclear in a shared kiosk.";
    const result = normalizeTurnAnalysis(
      {
        category: "positions",
        signals: [
          {
            kind: "concern",
            summary: "A fabricated concern",
            sourceQuote: "words that were never spoken",
            criterion: "increase quarterly revenue",
            evidenceBasis: "reported_evidence",
          },
        ],
      },
      text,
      CRITERIA,
    );

    expect(result.signals).toHaveLength(1);
    expect(result.signals?.[0]).toMatchObject({
      kind: "concern",
      sourceQuote: text,
      evidenceBasis: "inference",
    });
    expect(result.signals?.[0].criterion).toBeUndefined();
    expect(result.targetCriteria).toEqual([]);
  });

  it("bounds signal count and text length", () => {
    const text =
      "The model makes the exit route hard to see from the entrance.";
    const signals = Array.from({ length: 6 }, (_, index) => ({
      kind: "observation",
      summary: `${"long ".repeat(60)}${index}`,
      sourceQuote: "exit route",
      evidenceBasis: "direct_observation",
    }));
    const result = normalizeTurnAnalysis(
      { category: "evidence", signals },
      text,
      [],
    );

    expect(result.signals).toHaveLength(3);
    expect(
      result.signals?.every((signal) => signal.summary.length <= 180),
    ).toBe(true);
  });

  it("derives critique kinds when the model only returns a legacy category", () => {
    const action = normalizeTurnAnalysis(
      { category: "actions", confidence: 0.7 },
      "I'll prototype the two recovery states by Friday.",
      CRITERIA,
    );
    const question = normalizeTurnAnalysis(
      { category: "questions", confidence: 0.7 },
      "What happens if the user returns after ten minutes?",
      CRITERIA,
    );

    expect(action.signals?.[0].kind).toBe("action");
    expect(question.signals?.[0].kind).toBe("question");
  });

  it("requires explicit commitment language before exposing a decision", () => {
    const text =
      "I will prototype both recovery states by Friday so we can compare completion and privacy errors.";
    const result = normalizeTurnAnalysis(
      {
        category: "actions",
        confidence: 0.9,
        signals: [
          {
            kind: "action",
            summary: "Prototype both states",
            sourceQuote: "I will prototype both recovery states by Friday",
            evidenceBasis: "none",
          },
          {
            kind: "decision",
            summary: "Compare completion and privacy errors",
            sourceQuote: "so we can compare completion and privacy errors",
            evidenceBasis: "none",
          },
        ],
      },
      text,
      CRITERIA,
    );

    expect(result.signals?.map((item) => item.kind)).toEqual(["action"]);
  });

  it("keeps a source-anchored decision when the turn explicitly commits", () => {
    const text = "We agreed to use the neutral recovery state for the pilot.";
    const result = normalizeTurnAnalysis(
      {
        category: "decisions",
        confidence: 0.9,
        signals: [
          {
            kind: "decision",
            summary: "Use the neutral recovery state",
            sourceQuote:
              "We agreed to use the neutral recovery state for the pilot",
            evidenceBasis: "none",
          },
        ],
      },
      text,
      CRITERIA,
    );

    expect(result.signals?.[0].kind).toBe("decision");
  });

  it("builds criterion coverage, open loops, options, decisions, and actions", () => {
    const turns = [
      turn(
        "evidence",
        "In the test, people missed the recovery message.",
        signal(
          "evidence",
          "People missed the recovery message",
          "people missed the recovery message",
          "reported_evidence",
          "clear recovery state",
        ),
        100,
      ),
      turn(
        "question",
        "What risk remains after verification?",
        signal(
          "question",
          "What risk remains after verification?",
          "What risk remains after verification?",
          "none",
          "privacy in shared settings",
        ),
        200,
      ),
      turn(
        "alternative",
        "Another approach is to reveal details after verification.",
        signal(
          "alternative",
          "Reveal details only after verification",
          "reveal details after verification",
          "inference",
          "privacy in shared settings",
        ),
        300,
      ),
      turn(
        "decision",
        "We agreed to test both recovery states.",
        signal(
          "decision",
          "Test both recovery states",
          "agreed to test both recovery states",
          "inference",
          "clear recovery state",
        ),
        400,
      ),
      turn(
        "action",
        "I'll build the interrupted-flow prototype.",
        signal(
          "action",
          "Build the interrupted-flow prototype",
          "I'll build the interrupted-flow prototype",
          "none",
        ),
        500,
      ),
    ];

    const snapshot = buildCritiqueIntelligence(turns, CRITERIA);

    expect(snapshot.analyzedTurnCount).toBe(5);
    expect(snapshot.lastUpdatedAtMs).toBe(500);
    expect(snapshot.openLoops).toHaveLength(1);
    expect(snapshot.alternatives).toHaveLength(1);
    expect(snapshot.decisions).toHaveLength(1);
    expect(snapshot.actions).toHaveLength(1);
    expect(snapshot.evidenceGaps).toHaveLength(2);
    expect(snapshot.criteriaCoverage).toEqual([
      expect.objectContaining({
        criterion: "clear recovery state",
        status: "evidenced",
      }),
      expect.objectContaining({
        criterion: "privacy in shared settings",
        status: "discussed",
      }),
      expect.objectContaining({
        criterion: "accessible interaction",
        status: "unaddressed",
      }),
    ]);
  });

  it("does not treat unanalyzed or non-substantive turns as intelligence", () => {
    const analyzed = turn(
      "question",
      "What evidence supports the handoff?",
      signal(
        "question",
        "Ask for handoff evidence",
        "What evidence supports the handoff?",
        "none",
      ),
      100,
    );
    const unanalyzed = {
      ...analyzed,
      id: "turn-unanalysed",
      analysis: undefined,
    };
    const incidental = {
      ...analyzed,
      id: "turn-incidental",
      isSubstantive: false,
    };

    const snapshot = buildCritiqueIntelligence(
      [analyzed, unanalyzed, incidental],
      [],
    );

    expect(snapshot.analyzedTurnCount).toBe(1);
    expect(snapshot.signalCounts.question).toBe(1);
  });

  it("maps signals to existing discussion categories without duplicate items", () => {
    const analysis: TurnAnalysis = {
      category: "positions",
      confidence: 0.8,
      signals: [
        signal(
          "concern",
          "The handoff is unclear",
          "handoff is unclear",
          "inference",
        ),
        signal(
          "concern",
          "The handoff is unclear",
          "handoff is unclear",
          "inference",
        ),
        signal(
          "alternative",
          "Use a neutral prompt",
          "neutral prompt",
          "inference",
        ),
      ],
    };

    expect(discussionItemsForAnalysis("turn-1", analysis, "fallback")).toEqual([
      {
        category: "questions",
        text: "The handoff is unclear",
        turnIds: ["turn-1"],
      },
      {
        category: "positions",
        text: "Use a neutral prompt",
        turnIds: ["turn-1"],
      },
    ]);
  });
});

function signal(
  kind: CritiqueSignal["kind"],
  summary: string,
  sourceQuote: string,
  evidenceBasis: CritiqueSignal["evidenceBasis"],
  criterion?: string,
): CritiqueSignal {
  return {
    kind,
    summary,
    sourceQuote,
    evidenceBasis,
    criterion,
    confidence: 0.85,
  };
}

function turn(
  id: string,
  text: string,
  critiqueSignal: CritiqueSignal,
  analysisReceivedAtMs: number,
): TranscriptTurnData {
  return {
    id,
    sessionId: "session-1",
    providerSessionId: "provider-1",
    providerTurnOrder: analysisReceivedAtMs,
    segmentIndex: 0,
    providerSpeakerLabel: "A",
    originalProviderSpeakerLabel: "A",
    startMs: 0,
    endMs: 3000,
    receivedAtMs: 10,
    originalText: text,
    currentText: text,
    isCalibration: false,
    isFinal: true,
    isSubstantive: true,
    isUnknownSpeaker: false,
    possibleOverlap: false,
    wasSpeakerRevised: false,
    isManuallyCorrected: false,
    analysis: {
      category:
        critiqueSignal.kind === "question"
          ? "questions"
          : critiqueSignal.kind === "decision"
            ? "decisions"
            : critiqueSignal.kind === "action"
              ? "actions"
              : critiqueSignal.kind === "evidence"
                ? "evidence"
                : "positions",
      confidence: 0.85,
      signals: [critiqueSignal],
      targetCriteria: critiqueSignal.criterion
        ? [critiqueSignal.criterion]
        : [],
    },
    analysisReceivedAtMs,
  };
}
