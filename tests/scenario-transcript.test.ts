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
    });
    expect(revised[1].delivery?.tone).toBe("checking a distinction");
    expect(revised[1].startMs).toBeUndefined();
    expect(revised[1].endMs).toBeUndefined();
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
