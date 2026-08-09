import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeTurnBatch,
  analyzeWindow,
  generatePrompt,
  type AnalysisConfig,
} from "@/lib/analysis";

const config: AnalysisConfig = {
  sessionObjective: "Choose a safe recovery flow",
  sessionPhase: "evaluate",
  sessionCriteria: ["privacy in shared settings"],
  runMode: "live",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("OpenAI analysis request compatibility", () => {
  it("uses max_completion_tokens for GPT-5 turn analysis", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    vi.stubEnv("ANALYSIS_MODEL", "gpt-5-mini-2025-08-07");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  analyses: [
                    {
                      id: "turn-1",
                      category: "evidence",
                      confidence: 0.9,
                      signals: [
                        {
                          kind: "evidence",
                          summary: "A shared kiosk exposed private details.",
                          sourceQuote: "shared kiosk exposed private details",
                          target: "recovery handoff",
                          criterion: "privacy in shared settings",
                          stance: "challenges",
                          evidenceBasis: "reported_evidence",
                          confidence: 0.9,
                        },
                      ],
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await analyzeTurnBatch(
      [
        {
          id: "turn-1",
          speakerLabel: "Speaker A",
          text: "The shared kiosk exposed private details in our test.",
          isSubstantive: true,
        },
      ],
      config,
    );

    const body = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(body.max_completion_tokens).toBe(2000);
    expect(body.reasoning_effort).toBe("minimal");
    expect(body).not.toHaveProperty("max_tokens");
    expect(result.get("turn-1")?.signals).toHaveLength(1);
  });

  it("uses max_completion_tokens for GPT-5 window analysis", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  theme: "Recovery privacy",
                  discussionState: "evaluation",
                  phaseAllocation: {
                    problemAndEvidence: 25,
                    ideas: 25,
                    evaluation: 40,
                    decisionsAndActions: 10,
                  },
                  openQuestions: [
                    { question: "This shape must be discarded" },
                    "What evidence supports the recovery claim?",
                  ],
                  positions: [],
                  decisions: [
                    { text: "This object must not reach persistence" },
                    "We agreed to test the neutral state.",
                  ],
                  actions: [{ text: "This object must be discarded" }],
                  agreementState: "unsupported-state",
                  supportingTurnIds: ["invented-turn"],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await analyzeWindow([], [], config);

    const body = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(body.max_completion_tokens).toBe(1500);
    expect(body.reasoning_effort).toBe("minimal");
    expect(body).not.toHaveProperty("max_tokens");
    expect(result.openQuestions).toEqual([
      "What evidence supports the recovery claim?",
    ]);
    expect(result.decisions).toEqual(["We agreed to test the neutral state."]);
    expect(result.actions).toEqual([]);
    expect(result.agreementState).toBe("emerging");
    expect(result.supportingTurnIds).toEqual([]);
  });

  it("keeps chronological turn evidence attached to its private prompt", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  theme: "Recovery tradeoffs",
                  discussionState: "The group is comparing two approaches.",
                  phaseAllocation: {
                    problemAndEvidence: 20,
                    ideas: 20,
                    evaluation: 50,
                    decisionsAndActions: 10,
                  },
                  openQuestions: ["Which recovery path protects privacy?"],
                  positions: [],
                  decisions: [],
                  actions: [],
                  agreementState: "divided",
                  supportingTurnIds: [
                    "turn-latest",
                    "invented-turn",
                    "turn-first",
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const turns = [
      {
        id: "turn-first",
        speakerLabel: "Speaker A",
        text: "Start with assisted recovery.",
        isSubstantive: true,
      },
      {
        id: "turn-latest",
        speakerLabel: "Speaker B",
        text: "That exposes account details in shared settings.",
        isSubstantive: true,
      },
    ];

    const result = await analyzeWindow(turns, [], config);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ content: string }>;
    };
    const prompt = generatePrompt(result, config);

    expect(body.messages[0].content.indexOf("turn-first")).toBeLessThan(
      body.messages[0].content.indexOf("turn-latest"),
    );
    expect(result.supportingTurnIds).toEqual(["turn-latest", "turn-first"]);
    expect(prompt).toMatchObject({
      text: "Which recovery path protects privacy?",
      supportingTurnIds: ["turn-latest", "turn-first"],
    });
  });

  it("falls back to bounded local analysis when the provider misses its deadline", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    vi.stubEnv("ANALYSIS_TIMEOUT_MS", "1000");
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(
              new DOMException("Analysis deadline exceeded", "AbortError"),
            );
          });
        }),
    );

    const result = await analyzeTurnBatch(
      [
        {
          id: "turn-timeout",
          speakerLabel: "Speaker A",
          text: "The data shows that users could not recover their account.",
          isSubstantive: true,
        },
      ],
      config,
    );

    expect(result.get("turn-timeout")?.category).toBe("evidence");
    expect(result.get("turn-timeout")?.signals).not.toHaveLength(0);
    expect(warning).toHaveBeenCalledWith(
      "Turn analysis deadline exceeded; using bounded local fallback.",
    );
  });
});
