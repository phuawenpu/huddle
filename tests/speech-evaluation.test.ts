import { describe, expect, it } from "vitest";
import {
  evaluateSpeechRecognition,
  type SpeechHypothesisTurn,
  type SpeechReferenceTurn,
} from "@/lib/speech-evaluation";

describe("speech recognition evaluation", () => {
  it("maps arbitrary provider labels and scores a perfect transcript", () => {
    const report = evaluateSpeechRecognition(
      [
        reference("a", "Alex", "hello from alex", 0, 1000),
        reference("b", "Blake", "hello from blake", 1000, 2000),
      ],
      [
        hypothesis("Y", "hello from alex", 0, 1000),
        hypothesis("X", "hello from blake", 1000, 2000),
      ],
      { collarMs: 0 },
    );

    expect(report.speakerMapping).toEqual([
      {
        hypothesisLabel: "X",
        referenceSpeakerId: "b",
        referenceSpeakerName: "Blake",
        overlappedMs: 1000,
      },
      {
        hypothesisLabel: "Y",
        referenceSpeakerId: "a",
        referenceSpeakerName: "Alex",
        overlappedMs: 1000,
      },
    ]);
    expect(report.wordError.overall.rate).toBe(0);
    expect(report.wordError.speakerAttributed.rate).toBe(0);
    expect(report.diarization.excludingOverlap.errorRate).toBe(0);
    expect(report.diarization.includingOverlap.errorRate).toBe(0);
  });

  it("separates perfect word recognition from merged-speaker confusion", () => {
    const report = evaluateSpeechRecognition(
      [
        reference("a", "Alex", "alpha one", 0, 1000),
        reference("b", "Blake", "beta two", 1000, 2000),
      ],
      [
        hypothesis("X", "alpha one", 0, 1000),
        hypothesis("X", "beta two", 1000, 2000),
      ],
      { collarMs: 0 },
    );

    expect(report.wordError.overall.rate).toBe(0);
    expect(report.wordError.speakerAttributed.rate).toBe(1);
    expect(report.diarization.excludingOverlap).toMatchObject({
      errorRate: 0.5,
      missedSpeechMs: 0,
      falseAlarmMs: 0,
      speakerConfusionMs: 1000,
      referenceSpeakerMs: 2000,
    });
  });

  it("reports overlap-only word loss and overlap-inclusive DER", () => {
    const report = evaluateSpeechRecognition(
      [
        reference("a", "Alex", "alpha bravo charlie delta", 0, 2000),
        reference("b", "Blake", "echo foxtrot", 1000, 2000),
      ],
      [hypothesis("X", "alpha bravo charlie delta", 0, 2000)],
      { collarMs: 0 },
    );

    expect(report.reference.overlapIntervals).toEqual([
      { startMs: 1000, endMs: 2000 },
    ]);
    expect(report.reference.overlapSpeakerMs).toBe(2000);
    expect(report.wordError.nonOverlap.rate).toBe(0);
    expect(report.wordError.overlapSpeakerAttributed).toMatchObject({
      deletions: 2,
      referenceWords: 4,
      rate: 0.5,
    });
    expect(report.diarization.excludingOverlap.errorRate).toBe(0);
    expect(report.diarization.includingOverlap.errorRate).toBeCloseTo(1 / 3);
    expect(report.diarization.includingOverlap.missedSpeechMs).toBe(1000);
  });

  it("uses calibration for label mapping while excluding it from scores", () => {
    const references: SpeechReferenceTurn[] = [
      { ...reference("a", "Alex", "Alex here", 0, 500), isCalibration: true },
      {
        ...reference("b", "Blake", "Blake here", 600, 1100),
        isCalibration: true,
      },
      reference("a", "Alex", "design alpha", 1200, 1700),
      reference("b", "Blake", "design beta", 1800, 2300),
    ];
    const report = evaluateSpeechRecognition(
      references,
      [
        hypothesis("Z0", "Alex here", 0, 500),
        hypothesis("Z1", "Blake here", 600, 1100),
        hypothesis("Z0", "design alpha", 1200, 1700),
        hypothesis("Z1", "design beta", 1800, 2300),
      ],
      { collarMs: 0 },
    );

    expect(report.window.calibrationExcluded).toBe(true);
    expect(report.reference.turnCount).toBe(2);
    expect(report.reference.wordCount).toBe(4);
    expect(report.hypothesis.wordCount).toBe(4);
    expect(report.speakerMapping).toHaveLength(2);
    expect(report.wordError.speakerAttributed.rate).toBe(0);
    expect(report.diarization.excludingOverlap.errorRate).toBe(0);
  });

  it("accounts separately for missed and false-alarm speaker time", () => {
    const report = evaluateSpeechRecognition(
      [reference("a", "Alex", "hello", 0, 1000)],
      [hypothesis("X", "hello", 0, 500), hypothesis("X", "extra", 1000, 1200)],
      { collarMs: 0, endMs: 1200 },
    );

    expect(report.diarization.excludingOverlap).toMatchObject({
      errorRate: 0.7,
      missedSpeechMs: 500,
      falseAlarmMs: 200,
      speakerConfusionMs: 0,
      totalErrorMs: 700,
      referenceSpeakerMs: 1000,
    });
  });
});

function reference(
  speakerId: string,
  speakerName: string,
  text: string,
  startMs: number,
  endMs: number,
): SpeechReferenceTurn {
  return {
    id: `${speakerId}-${startMs}`,
    speakerId,
    speakerName,
    text,
    startMs,
    endMs,
  };
}

function hypothesis(
  speakerLabel: string,
  text: string,
  startMs: number,
  endMs: number,
): SpeechHypothesisTurn {
  return { speakerLabel, text, startMs, endMs };
}
