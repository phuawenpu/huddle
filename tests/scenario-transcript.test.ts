import { describe, expect, it } from "vitest";
import {
  analyzeTranscriptQuality,
  normalizeScenarioTurns,
  toEditableTranscript,
  transcriptFingerprint,
  turnsFromEditableTranscript,
} from "@/lib/scenario-transcript";
import { createDefaultCasting } from "@/lib/voice-casting";
import type { ScenarioTurn } from "@/lib/types";

const speakers = createDefaultCasting(3);

describe("version-2 scenario transcripts", () => {
  it("rejects the repetitive round-robin pattern found in legacy scenarios", () => {
    const turns: ScenarioTurn[] = Array.from({ length: 15 }, (_, index) => ({
      id: `t${index}`,
      index,
      speakerIndex: index % 3,
      text:
        index % 5 === 0
          ? "I think the climate data view needs a clearer comparison point."
          : `Turn ${index} adds a mechanical but otherwise substantive observation here.`,
      expectedCategory: "positions",
      expected: {
        substantive: true,
        category: "positions",
        reactsToTurnId: index > 0 ? `t${index - 1}` : undefined,
      },
      pauseBeforeMs: 400,
    }));

    const report = analyzeTranscriptQuality(turns, speakers);

    expect(report.errors).toContain(
      "Speaker order is effectively round-robin rather than conversational.",
    );
    expect(report.duplicateGroups).toHaveLength(1);
    expect(report.duplicateGroups[0].turnIds).toEqual(["t0", "t5", "t10"]);
    expect(report.score).toBeLessThan(70);
  });

  it("round-trips relative overlap and delivery while clearing realized timing on revision", () => {
    const turns = normalizeScenarioTurns(
      [
        {
          id: "t0",
          speakerIndex: 0,
          text: "The retry action disappears after the error.",
          startMs: 100,
          endMs: 1900,
        },
        {
          id: "t1",
          speakerIndex: 1,
          text: "Wait—only after a timeout, or after every error?",
          timing: {
            gapBeforeMs: 0,
            overlap: {
              withTurnId: "t0",
              startBeforeEndMs: 520,
              kind: "interruption",
              resolution: "yield",
            },
            realizedStartMs: 1380,
            realizedEndMs: 2600,
          },
          delivery: {
            pace: "quick",
            tone: "checking a distinction",
            volume: "normal",
            disfluency: "light",
          },
          dialogue: {
            act: "questions",
            substantive: true,
            respondsToTurnId: "t0",
            intent: "clarify the failure condition",
          },
        },
        {
          id: "t2",
          speakerIndex: 0,
          text: "Only after a timeout—I should have said that first.",
          pauseBeforeMs: 280,
          expected: { reactsToTurnId: "t1" },
        },
      ],
      speakers.length,
    );
    const document = toEditableTranscript(
      "Retry flow",
      "Find the next test",
      speakers,
      turns,
      {
        targetDurationMinutes: 5,
        phase: "evaluate",
        criteria: ["Recovery clarity", "Trust"],
        difficulty: "challenging",
        crossTalkLevel: "occasional",
        participationProfile: "mixed",
      },
    );
    const revised = turnsFromEditableTranscript(document, speakers);

    expect(document.turns[1].timing.overlap).toMatchObject({
      withTurnId: "t0",
      startBeforeEndMs: 520,
      resolution: "yield",
    });
    expect(document.sessionContext).toEqual({
      targetDurationMinutes: 5,
      phase: "evaluate",
      criteria: ["Recovery clarity", "Trust"],
      difficulty: "challenging",
      crossTalkLevel: "occasional",
      participationProfile: "mixed",
    });
    expect(revised[1].delivery?.tone).toBe("checking a distinction");
    expect(revised[1].startMs).toBeUndefined();
    expect(revised[1].endMs).toBeUndefined();
  });

  it("reports duration density and rejects overlap that contradicts no cross-talk", () => {
    const turns = normalizeScenarioTurns(
      [
        {
          id: "t0",
          speakerIndex: 0,
          text: "The selected layer does not explain its source or update date.",
        },
        {
          id: "t1",
          speakerIndex: 1,
          text: "Exactly, and that makes the comparison look more certain than it is.",
          overlap: {
            withTurnId: "t0",
            startBeforeEndMs: 400,
            kind: "eager_agreement",
            resolution: "continue",
          },
        },
        {
          id: "t2",
          speakerIndex: 2,
          text: "Then the prototype needs visible dates and uncertainty language.",
        },
      ],
      speakers.length,
    );

    const report = analyzeTranscriptQuality(turns, speakers, {
      targetDurationMinutes: 0.1,
      crossTalkLevel: "none",
    });

    expect(report.errors).toContain(
      "Transcript contains 1 overlap start, but cross-talk is configured as none.",
    );
    expect(report.plannedWordsPerMinute).toBeGreaterThan(185);
  });

  it("warns when a substantial draft cannot fit its requested duration", () => {
    const turns: ScenarioTurn[] = Array.from({ length: 9 }, (_, index) => ({
      id: `dense-${index}`,
      index,
      speakerIndex: [0, 1, 1, 2, 0, 2, 2, 1, 0][index],
      text: `This deliberately detailed utterance number ${index} carries far more planned speech than the requested workshop duration can plausibly contain without rushing.`,
      expectedCategory: "positions",
      expected: {
        substantive: true,
        category: "positions",
        reactsToTurnId: index ? `dense-${index - 1}` : undefined,
      },
      pauseBeforeMs: 350,
    }));

    const report = analyzeTranscriptQuality(turns, speakers, {
      targetDurationMinutes: 0.5,
      crossTalkLevel: "none",
    });

    expect(report.warnings).toContain(
      `Planned dialogue density is ${report.plannedWordsPerMinute} words per requested minute; target roughly 105–185 after allowing for pauses.`,
    );
  });

  it("fingerprints authored audio inputs but ignores measured timestamps", () => {
    const base = normalizeScenarioTurns(
      [
        {
          id: "t0",
          speakerIndex: 0,
          text: "The evidence is in the retry logs.",
          pauseBeforeMs: 300,
        },
        {
          id: "t1",
          speakerIndex: 2,
          text: "Then let’s inspect failures before changing the screen.",
          pauseBeforeMs: 420,
        },
        {
          id: "t2",
          speakerIndex: 0,
          text: "Agreed; I’ll bring the timeout cases into tomorrow’s test.",
          pauseBeforeMs: 260,
        },
      ],
      speakers.length,
    );
    const measured = base.map((turn, index) => ({
      ...turn,
      startMs: index * 2000,
      endMs: index * 2000 + 1500,
    }));
    const changed = base.map((turn, index) =>
      index === 1 ? { ...turn, text: `${turn.text} First.` } : turn,
    );

    expect(transcriptFingerprint(speakers, measured)).toBe(
      transcriptFingerprint(speakers, base),
    );
    expect(transcriptFingerprint(speakers, changed)).not.toBe(
      transcriptFingerprint(speakers, base),
    );
  });
});
