import { describe, it, expect } from "vitest";
import { stubTopicSuggestions, stubGenerateScenario, stubAnalyzeTurn, stubEstimateScenario } from "@/lib/stubs/openai";

describe("stubTopicSuggestions", () => {
  it("returns requested number of suggestions", () => {
    const suggestions = stubTopicSuggestions(42, [], 5);
    expect(suggestions).toHaveLength(5);
  });

  it("excludes specified topics", () => {
    const all = stubTopicSuggestions(42, [], 10);
    const first = all[0].topic;
    const filtered = stubTopicSuggestions(42, [first], 10);
    expect(filtered.every(s => s.topic !== first)).toBe(true);
  });

  it("is deterministic with same seed", () => {
    const a = stubTopicSuggestions(42, [], 5);
    const b = stubTopicSuggestions(42, [], 5);
    expect(a.map(s => s.topic)).toEqual(b.map(s => s.topic));
  });

  it("each suggestion has required fields", () => {
    const suggestions = stubTopicSuggestions(0, [], 3);
    for (const s of suggestions) {
      expect(s.topic).toBeTruthy();
      expect(s.domain).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });
});

describe("stubGenerateScenario", () => {
  it("generates scenario with correct speaker count", () => {
    const scenario = stubGenerateScenario({
      topic: "Test topic",
      durationMinutes: 8,
      speakerCount: 4,
      difficulty: "realistic",
      crossTalkLevel: "occasional",
    });
    expect(scenario.speakers).toHaveLength(4);
  });

  it("generates turns proportional to duration", () => {
    const short = stubGenerateScenario({
      topic: "Test",
      durationMinutes: 3,
      speakerCount: 4,
      difficulty: "clean",
      crossTalkLevel: "none",
    });
    const long = stubGenerateScenario({
      topic: "Test",
      durationMinutes: 10,
      speakerCount: 4,
      difficulty: "clean",
      crossTalkLevel: "none",
    });
    expect(long.turns.length).toBeGreaterThan(short.turns.length);
  });

  it("has unique voice IDs for speakers", () => {
    const scenario = stubGenerateScenario({
      topic: "Test",
      durationMinutes: 8,
      speakerCount: 6,
      difficulty: "realistic",
      crossTalkLevel: "occasional",
    });
    const voiceIds = scenario.speakers.map(s => s.voiceId);
    expect(new Set(voiceIds).size).toBe(voiceIds.length);
  });

  it("generates budget", () => {
    const scenario = stubGenerateScenario({
      topic: "Test",
      durationMinutes: 8,
      speakerCount: 4,
      difficulty: "realistic",
      crossTalkLevel: "occasional",
    });
    expect(scenario.budget.estimatedTurns).toBeGreaterThan(0);
    expect(scenario.budget.estimatedCostUsd).toBeGreaterThanOrEqual(0);
  });

  it("generates reasonable turn counts", () => {
    // ~8 minutes * 8-11 turns/min = ~64-88 turns
    const scenario = stubGenerateScenario({
      topic: "Test",
      durationMinutes: 8,
      speakerCount: 4,
      difficulty: "realistic",
      crossTalkLevel: "occasional",
    });
    expect(scenario.turns.length).toBeGreaterThan(20);
    expect(scenario.turns.length).toBeLessThan(200);
  });

  it("all turns have text content", () => {
    const scenario = stubGenerateScenario({
      topic: "Test topic",
      durationMinutes: 8,
      speakerCount: 4,
      difficulty: "clean",
      crossTalkLevel: "none",
    });
    for (const turn of scenario.turns) {
      expect(turn.text).toBeTruthy();
      expect(turn.speakerIndex).toBeGreaterThanOrEqual(0);
      expect(turn.speakerIndex).toBeLessThan(4);
    }
  });
});

describe("stubAnalyzeTurn", () => {
  it("returns a valid analysis", () => {
    const analysis = stubAnalyzeTurn(
      "I think we should look at the evidence from the user tests.",
      "Evaluate onboarding",
      [],
      42
    );
    expect(analysis.category).toBeTruthy();
    expect(analysis.confidence).toBeGreaterThan(0.7);
    expect(analysis.confidence).toBeLessThan(1);
  });

  it("detects evidence category from keywords", () => {
    const analysis = stubAnalyzeTurn(
      "The data shows that users prefer the simplified flow.",
      "Evaluate onboarding",
      [],
      0
    );
    expect(analysis.category).toBe("evidence");
  });

  it("detects questions category", () => {
    const analysis = stubAnalyzeTurn(
      "What if we tried a different approach?",
      "Evaluate onboarding",
      [],
      0
    );
    expect(analysis.category).toBe("questions");
  });

  it("detects decisions category", () => {
    const analysis = stubAnalyzeTurn(
      "We have decided to go with the card-based approach.",
      "Evaluate onboarding",
      [],
      0
    );
    expect(analysis.category).toBe("decisions");
  });

  it("detects actions category", () => {
    const analysis = stubAnalyzeTurn(
      "I will do the prototype by next week.",
      "Evaluate onboarding",
      [],
      0
    );
    expect(analysis.category).toBe("actions");
  });
});

describe("stubEstimateScenario", () => {
  it("returns budget proportional to duration", () => {
    const short = stubEstimateScenario(3, 4, "none");
    const long = stubEstimateScenario(15, 4, "none");
    expect(long.estimatedTurns).toBeGreaterThan(short.estimatedTurns);
  });
});
