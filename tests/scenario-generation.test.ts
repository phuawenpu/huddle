import { describe, expect, it } from "vitest";
import {
  buildDiscussionPrompts,
  normalizeGeneratedScenario,
} from "@/lib/scenario-generation";

const input = {
  topic: "A public-library self-checkout kiosk",
  durationMinutes: 5,
  speakerCount: 3,
  difficulty: "realistic",
  crossTalkLevel: "occasional" as const,
};

describe("discussion generation contract", () => {
  it("prompts for causal, non-round-robin spoken dialogue", () => {
    const { system, budget } = buildDiscussionPrompts(input);
    expect(system).toContain("Every main turn after the first must respond");
    expect(system).toContain("People should not speak in round-robin order");
    expect(system).toContain("Ban empty phrases");
    expect(system).toContain("one repaired misunderstanding");
    expect(budget.targetTurns).toBeGreaterThan(30);
  });

  it("normalizes casts, reactions, calibration, pauses, and overlap bounds", () => {
    const raw = {
      title: "Kiosk critique",
      objective: "Find the next useful test",
      criteria: ["Accessibility", "Recovery"],
      speakers: [
        { name: "A", role: "researcher" },
        { name: "B", role: "designer" },
        { name: "C", role: "operator" },
      ],
      turns: [
        { speakerIndex: 0, text: "I am A and I will listen for evidence from patrons." },
        { speakerIndex: 1, text: "I am B and I will watch how the flow recovers from mistakes." },
        { speakerIndex: 2, text: "I am C and I will focus on what staff need during busy periods." },
        { speakerIndex: 1, text: "The confirmation disappears before I can check the total.", expectedCategory: "evidence" },
        {
          speakerIndex: 0,
          text: "Wait—the disappearing message, or the receipt itself?",
          expectedCategory: "questions",
          expected: { reactsToTurnId: "t3" },
          overlap: { startOffsetMs: 9999, kind: "interruption" },
        },
        {
          speakerIndex: 2,
          text: "The message. Staff can reprint a receipt, but they cannot restore confidence in a vanished total.",
          expectedCategory: "positions",
          expected: { reactsToTurnId: "t4" },
        },
      ],
    };

    const result = normalizeGeneratedScenario(raw, input);
    expect(result.speakers.map((speaker) => speaker.voiceId)).toEqual([
      "cedar",
      "marin",
      "sage",
    ]);
    expect(new Set(result.speakers.map((speaker) => speaker.instructions)).size).toBe(3);
    expect(result.turns.slice(0, 3).every((turn) => turn.isCalibration)).toBe(true);
    expect(result.turns[4].expected?.reactsToTurnId).toBe("t3");
    expect(result.turns[4].overlap?.startOffsetMs).toBe(1500);
    expect(result.turns[4].pauseBeforeMs).toBe(0);
  });
});
