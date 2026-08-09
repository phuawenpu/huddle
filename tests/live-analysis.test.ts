import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeFullTranscript,
  partitionTranscript,
  type LiveAnalysisTurn,
} from "@/lib/live-analysis";
import { analyzeVisualEvidence } from "@/lib/visual-evidence";

const turns: LiveAnalysisTurn[] = [
  {
    id: "turn-first",
    speakerLabel: "A",
    text: "The opening field study showed that residents missed the warning.",
    startMs: 1_000,
    endMs: 4_000,
  },
  {
    id: "turn-middle",
    speakerLabel: "B",
    text: "Could a persistent warning explain the risk without obscuring the map?",
    startMs: 4_500,
    endMs: 8_000,
  },
  {
    id: "turn-last",
    speakerLabel: "C",
    text: "I will prototype both warning treatments for the next review.",
    startMs: 8_500,
    endMs: 12_000,
  },
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("whole-transcript live analysis", () => {
  it("covers the first, middle, and latest turns in deterministic mode", async () => {
    vi.stubEnv("LLM_STUB", "1");
    const result = await analyzeFullTranscript(turns, [], {
      objective: "Assess warning comprehension",
      phase: "evaluate",
      criteria: ["Warnings are understood"],
    });

    expect(result.engine).toBe("deterministic-fallback");
    expect(result.summary).toContain("all 3 substantive turns");
    expect(
      result.keyFindings.flatMap((finding) => finding.supportingTurnIds),
    ).toEqual(["turn-first", "turn-middle", "turn-last"]);
    expect(result.headline).toContain("Assess warning comprehension");
  });

  it("can be run repeatedly with a new intent without losing transcript scope", async () => {
    vi.stubEnv("LLM_STUB", "1");
    const first = await analyzeFullTranscript(turns, [], {
      objective: "Find evidence gaps",
      phase: "define",
      criteria: ["Evidence quality"],
    });
    const second = await analyzeFullTranscript(turns, [], {
      objective: "Find concrete next actions",
      phase: "plan_experiment",
      criteria: ["Owner and next step"],
    });

    expect(first.headline).not.toBe(second.headline);
    expect(first.summary).toContain("all 3 substantive turns");
    expect(second.summary).toContain("all 3 substantive turns");
    expect(second.actions).toEqual([
      expect.objectContaining({ supportingTurnIds: ["turn-last"] }),
    ]);
  });

  it("truncates long HUD headlines on a word boundary", async () => {
    vi.stubEnv("LLM_STUB", "1");
    const result = await analyzeFullTranscript(turns, [], {
      objective: `Assess ${"carefully articulated evidence ".repeat(12)}`,
      phase: "evaluate",
      criteria: [],
    });

    expect(result.headline.length).toBeLessThanOrEqual(160);
    expect(result.headline).toMatch(/…$/);
    expect(result.headline.at(-2)).not.toBe(" ");
  });

  it("partitions long discussions without dropping or duplicating turns", () => {
    const longTurns = Array.from({ length: 75 }, (_, index) => ({
      id: `turn-${index}`,
      speakerLabel: String.fromCharCode(65 + (index % 3)),
      text: `Discussion point ${index} ${"supporting detail ".repeat(12)}`,
      startMs: index * 1_000,
      endMs: index * 1_000 + 900,
    }));
    const chunks = partitionTranscript(longTurns, 1_200);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat().map((turn) => turn.id)).toEqual(
      longTurns.map((turn) => turn.id),
    );
  });

  it("sends the complete scope and keeps only valid source turn IDs", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    vi.stubEnv("LLM_STUB", "0");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  headline: "Warning treatment needs a comparative test",
                  summary:
                    "Evidence begins with field observation and ends with an owned prototype.",
                  keyFindings: [
                    {
                      title: "Observed problem",
                      text: "Residents missed the warning.",
                      sourceQuotes: [
                        {
                          turnId: "turn-first",
                          quote: "residents missed the warning",
                        },
                        {
                          turnId: "invented-turn",
                          quote: "invented evidence",
                        },
                      ],
                    },
                    {
                      title: "Owned action",
                      text: "A prototype is assigned.",
                      sourceQuotes: [
                        {
                          turnId: "turn-last",
                          quote: "I will prototype both warning treatments",
                        },
                      ],
                    },
                  ],
                  criteria: [
                    {
                      criterion: "Warnings are understood",
                      status: "evidenced",
                      text: "The field study supplies evidence.",
                      sourceQuotes: [
                        {
                          turnId: "turn-first",
                          quote: "The opening field study showed",
                        },
                      ],
                    },
                    {
                      criterion: "Action ownership",
                      status: "evidenced",
                      text: "An owner was assigned.",
                      sourceQuotes: [
                        {
                          turnId: "turn-middle",
                          quote: "This quote is not in the transcript",
                        },
                      ],
                    },
                  ],
                  openQuestions: [],
                  decisions: [],
                  actions: [
                    {
                      text: "Prototype both treatments.",
                      sourceQuotes: [
                        {
                          turnId: "turn-last",
                          quote: "prototype both warning treatments",
                        },
                      ],
                    },
                  ],
                  phaseAllocation: {
                    problemAndEvidence: 40,
                    ideas: 20,
                    evaluation: 20,
                    decisionsAndActions: 20,
                  },
                  agreementState: "emerging",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await analyzeFullTranscript(turns, [], {
      objective: "Assess warning comprehension",
      phase: "evaluate",
      criteria: ["Warnings are understood", "Action ownership"],
    });
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const payload = JSON.parse(requestBody.messages[1].content);

    expect(payload.coverage).toMatchObject({
      firstTurnId: "turn-first",
      lastTurnId: "turn-last",
      totalTranscriptTurns: 3,
    });
    expect(payload.transcript.map((turn: { id: string }) => turn.id)).toEqual([
      "turn-first",
      "turn-middle",
      "turn-last",
    ]);
    expect(result.keyFindings[0].supportingTurnIds).toEqual(["turn-first"]);
    expect(result.grounding).toEqual({
      validatedSourceCount: 4,
      rejectedSourceCount: 2,
    });
    expect(result.criteria[1]).toMatchObject({
      criterion: "Action ownership",
      status: "unaddressed",
      supportingTurnIds: [],
    });
    expect(result.engine).toBe("model");
  });
});

describe("visual evidence analysis", () => {
  it("sends an image with bounded discussion context", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    vi.stubEnv("LLM_STUB", "0");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  caption: "A warning panel beside a risk map",
                  observations: ["The warning competes with the map legend"],
                  relevance: "The frame shows the treatment being critiqued.",
                  confidence: 0.82,
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await analyzeVisualEvidence(
      Buffer.from("image-bytes"),
      "image/jpeg",
      {
        objective: "Assess warning comprehension",
        phase: "evaluate",
        note: "Prototype warning",
        recentTurns: turns.map(({ id, speakerLabel, text }) => ({
          id,
          speakerLabel,
          text,
        })),
      },
    );
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const imagePart = requestBody.messages[1].content[1];

    expect(imagePart.image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.engine).toBe("model");
    expect(result.caption).toContain("warning panel");
  });
});
