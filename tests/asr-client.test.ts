import { describe, expect, it } from "vitest";
import { segmentFinalTurn, type TurnEvent } from "@/lib/client/asr-client";

describe("streaming ASR final-turn segmentation", () => {
  it("preserves contiguous word-level speaker changes as separate segments", () => {
    const turn: TurnEvent = {
      turnOrder: 7,
      endOfTurn: true,
      transcript: "The delay is confusing. Yeah, especially on retry.",
      speakerLabel: "A",
      words: [
        { text: "The", start: 100, end: 180, confidence: 0.97, wordIsFinal: true, speaker: "A" },
        { text: "delay", start: 185, end: 300, confidence: 0.96, wordIsFinal: true, speaker: "A" },
        { text: "is", start: 305, end: 350, confidence: 0.96, wordIsFinal: true, speaker: "A" },
        { text: "confusing.", start: 355, end: 540, confidence: 0.95, wordIsFinal: true, speaker: "A" },
        { text: "Yeah,", start: 480, end: 590, confidence: 0.92, wordIsFinal: true, speaker: "B" },
        { text: "especially", start: 600, end: 760, confidence: 0.94, wordIsFinal: true, speaker: "B" },
        { text: "on", start: 765, end: 805, confidence: 0.95, wordIsFinal: true, speaker: "B" },
        { text: "retry.", start: 810, end: 930, confidence: 0.96, wordIsFinal: true, speaker: "B" },
      ],
    };

    const segments = segmentFinalTurn(turn, "provider-session", 1040);

    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segment.segmentIndex)).toEqual([0, 1]);
    expect(segments.map((segment) => segment.providerSpeakerLabel)).toEqual(["A", "B"]);
    expect(segments.map((segment) => segment.currentText)).toEqual([
      "The delay is confusing.",
      "Yeah, especially on retry.",
    ]);
    expect(segments.every((segment) => segment.possibleOverlap)).toBe(true);
    expect(segments[1]).toMatchObject({ startMs: 480, endMs: 930 });
  });

  it("keeps an explicit UNKNOWN label instead of inventing a speaker", () => {
    const [segment] = segmentFinalTurn(
      {
        turnOrder: 2,
        endOfTurn: true,
        transcript: "Mm-hm.",
        speakerLabel: "UNKNOWN",
        words: [],
      },
      "provider-session",
      500
    );

    expect(segment.providerSpeakerLabel).toBe("UNKNOWN");
    expect(segment.isUnknownSpeaker).toBe(true);
  });
});
