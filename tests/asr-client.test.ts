import { describe, expect, it } from "vitest";
import {
  latestAttributedSpeakerLabel,
  segmentFinalTurn,
  type TurnEvent,
} from "@/lib/client/asr-client";

describe("streaming ASR final-turn segmentation", () => {
  it("uses the latest finalized word speaker at the live edge", () => {
    expect(
      latestAttributedSpeakerLabel({
        speakerLabel: "A",
        words: [
          {
            text: "Earlier",
            start: 0,
            end: 300,
            confidence: 0.98,
            wordIsFinal: true,
            speaker: "A",
          },
          {
            text: "response",
            start: 320,
            end: 700,
            confidence: 0.97,
            wordIsFinal: true,
            speaker: "B",
          },
        ],
      }),
    ).toBe("B");
  });

  it("falls back to the dominant turn label until word attribution resolves", () => {
    expect(
      latestAttributedSpeakerLabel({
        speakerLabel: "C",
        words: [
          {
            text: "Resolving",
            start: 0,
            end: 300,
            confidence: 0.8,
            wordIsFinal: false,
          },
        ],
      }),
    ).toBe("C");
    expect(
      latestAttributedSpeakerLabel({
        speakerLabel: "UNKNOWN",
        words: [],
      }),
    ).toBeNull();
  });

  it("preserves contiguous word-level speaker changes as separate segments", () => {
    const turn: TurnEvent = {
      turnOrder: 7,
      endOfTurn: true,
      transcript: "The delay is confusing. Yeah, especially on retry.",
      speakerLabel: "A",
      words: [
        {
          text: "The",
          start: 100,
          end: 180,
          confidence: 0.97,
          wordIsFinal: true,
          speaker: "A",
        },
        {
          text: "delay",
          start: 185,
          end: 300,
          confidence: 0.96,
          wordIsFinal: true,
          speaker: "A",
        },
        {
          text: "is",
          start: 305,
          end: 350,
          confidence: 0.96,
          wordIsFinal: true,
          speaker: "A",
        },
        {
          text: "confusing.",
          start: 355,
          end: 540,
          confidence: 0.95,
          wordIsFinal: true,
          speaker: "A",
        },
        {
          text: "Yeah,",
          start: 480,
          end: 590,
          confidence: 0.92,
          wordIsFinal: true,
          speaker: "B",
        },
        {
          text: "especially",
          start: 600,
          end: 760,
          confidence: 0.94,
          wordIsFinal: true,
          speaker: "B",
        },
        {
          text: "on",
          start: 765,
          end: 805,
          confidence: 0.95,
          wordIsFinal: true,
          speaker: "B",
        },
        {
          text: "retry.",
          start: 810,
          end: 930,
          confidence: 0.96,
          wordIsFinal: true,
          speaker: "B",
        },
      ],
    };

    const segments = segmentFinalTurn(turn, "provider-session", 1040);

    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segment.segmentIndex)).toEqual([0, 1]);
    expect(segments.map((segment) => segment.providerSpeakerLabel)).toEqual([
      "A",
      "B",
    ]);
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
      500,
    );

    expect(segment.providerSpeakerLabel).toBe("UNKNOWN");
    expect(segment.isUnknownSpeaker).toBe(true);
  });

  it("folds provider PENDING words into the sole stable speaker", () => {
    const segments = segmentFinalTurn(
      {
        turnOrder: 0,
        endOfTurn: true,
        transcript: "Alex here. I am ready.",
        speakerLabel: "PENDING",
        words: [
          {
            text: "Alex",
            start: 100,
            end: 220,
            confidence: 0.99,
            wordIsFinal: true,
            speaker: "PENDING",
          },
          {
            text: "here.",
            start: 230,
            end: 360,
            confidence: 0.98,
            wordIsFinal: true,
            speaker: "PENDING",
          },
          {
            text: "I",
            start: 700,
            end: 740,
            confidence: 0.99,
            wordIsFinal: true,
            speaker: "A",
          },
          {
            text: "am",
            start: 750,
            end: 810,
            confidence: 0.99,
            wordIsFinal: true,
            speaker: "A",
          },
          {
            text: "ready.",
            start: 820,
            end: 980,
            confidence: 0.99,
            wordIsFinal: true,
            speaker: "A",
          },
        ],
      },
      "provider-session",
      1100,
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      providerSpeakerLabel: "A",
      currentText: "Alex here. I am ready.",
      isUnknownSpeaker: false,
      possibleOverlap: false,
    });
  });

  it("persists an all-PENDING turn as UNKNOWN", () => {
    const [segment] = segmentFinalTurn(
      {
        turnOrder: 0,
        endOfTurn: true,
        transcript: "Mm.",
        speakerLabel: "PENDING",
        words: [
          {
            text: "Mm.",
            start: 100,
            end: 300,
            confidence: 0.6,
            wordIsFinal: true,
            speaker: "PENDING",
          },
        ],
      },
      "provider-session",
      400,
    );

    expect(segment.providerSpeakerLabel).toBe("UNKNOWN");
    expect(segment.isUnknownSpeaker).toBe(true);
  });

  it("does not flag a separated speaker transition as possible overlap", () => {
    const segments = segmentFinalTurn(
      {
        turnOrder: 3,
        endOfTurn: true,
        transcript: "Casey is ready. Alex starts next.",
        speakerLabel: "A",
        words: [
          {
            text: "Casey",
            start: 100,
            end: 220,
            confidence: 0.99,
            wordIsFinal: true,
            speaker: "B",
          },
          {
            text: "is",
            start: 230,
            end: 270,
            confidence: 0.99,
            wordIsFinal: true,
            speaker: "B",
          },
          {
            text: "ready.",
            start: 280,
            end: 420,
            confidence: 0.99,
            wordIsFinal: true,
            speaker: "B",
          },
          {
            text: "Alex",
            start: 900,
            end: 1020,
            confidence: 0.99,
            wordIsFinal: true,
            speaker: "A",
          },
          {
            text: "starts",
            start: 1030,
            end: 1150,
            confidence: 0.99,
            wordIsFinal: true,
            speaker: "A",
          },
          {
            text: "next.",
            start: 1160,
            end: 1280,
            confidence: 0.99,
            wordIsFinal: true,
            speaker: "A",
          },
        ],
      },
      "provider-session",
      1400,
    );

    expect(segments).toHaveLength(2);
    expect(segments.every((segment) => !segment.possibleOverlap)).toBe(true);
  });
});
