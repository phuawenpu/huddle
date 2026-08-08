import { describe, it, expect } from "vitest";
import {
  isSubstantiveTurn,
  wordErrorRate,
  hungarianMatch,
  seededRandom,
  clamp,
  formatMs,
  parseCriteria,
} from "@/lib/utils";

describe("isSubstantiveTurn", () => {
  it("returns false for bare acknowledgements", () => {
    expect(isSubstantiveTurn("ok", 500)).toBe(false);
    expect(isSubstantiveTurn("yeah", 300)).toBe(false);
    expect(isSubstantiveTurn("right", 200)).toBe(false);
    expect(isSubstantiveTurn("thank you", 400)).toBe(false);
    expect(isSubstantiveTurn("got it", 300)).toBe(false);
    expect(isSubstantiveTurn("hmm", 100)).toBe(false);
    expect(isSubstantiveTurn("i see", 200)).toBe(false);
  });

  it("returns true for turns with >= 4 words", () => {
    expect(isSubstantiveTurn("I think we should focus", 200)).toBe(true);
    expect(isSubstantiveTurn("This is four words", 100)).toBe(true);
  });

  it("returns true for turns >= 1.2 seconds regardless of word count", () => {
    expect(isSubstantiveTurn("No way.", 1200)).toBe(true);
    expect(isSubstantiveTurn("Yes.", 1500)).toBe(true);
  });

  it("returns false for short, quick turns", () => {
    expect(isSubstantiveTurn("ok", 500)).toBe(false);
    expect(isSubstantiveTurn("hi", 100)).toBe(false);
  });

  it("handles whitespace and capitalization", () => {
    expect(isSubstantiveTurn("  OK  ", 500)).toBe(false);
    expect(isSubstantiveTurn("I Think We Should Go", 200)).toBe(true);
  });
});

describe("wordErrorRate", () => {
  it("returns 0 for identical strings", () => {
    expect(wordErrorRate("hello world", "hello world")).toBe(0);
  });

  it("returns proper WER for substitutions", () => {
    const wer = wordErrorRate("the cat sat", "the dog sat");
    expect(wer).toBeCloseTo(1 / 3, 2);
  });

  it("returns proper WER for deletions", () => {
    const wer = wordErrorRate("the cat sat down", "the cat sat");
    expect(wer).toBeCloseTo(1 / 4, 2);
  });

  it("returns proper WER for insertions", () => {
    const wer = wordErrorRate("the cat sat", "the big cat sat");
    expect(wer).toBeCloseTo(1 / 3, 2);
  });

  it("returns 1 for completely different strings", () => {
    expect(wordErrorRate("hello", "")).toBe(1);
  });

  it("returns 0 for both empty", () => {
    expect(wordErrorRate("", "")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(wordErrorRate("Hello World", "hello world")).toBe(0);
  });

  it("ignores punctuation and Unicode apostrophe formatting", () => {
    expect(
      wordErrorRate(
        "Exactly—especially the uncertainty label.",
        "Exactly, especially the uncertainty label.",
      ),
    ).toBe(0);
    expect(wordErrorRate("I’m ready.", "I'm ready")).toBe(0);
  });

  it("treats hyphenated and slash-delimited words as lexical boundaries", () => {
    expect(wordErrorRate("capital-project", "capital project")).toBe(0);
    expect(wordErrorRate("sharing-governance", "sharing/governance")).toBe(0);
  });
});

describe("hungarianMatch", () => {
  it("returns correct assignment for 3x3 matrix", () => {
    const costs = [
      [1, 5, 3],
      [5, 1, 5],
      [3, 5, 1],
    ];
    const assignment = hungarianMatch(costs);
    // Best assignment should be [0, 1, 2] (diagonal)
    expect(assignment).toEqual([0, 1, 2]);
  });

  it("returns empty for empty matrix", () => {
    expect(hungarianMatch([])).toEqual([]);
  });

  it("handles rectangular matrices", () => {
    const costs = [
      [1, 5, 3],
      [5, 1, 5],
    ];
    const assignment = hungarianMatch(costs);
    expect(assignment.length).toBe(2);
    expect(assignment.every((a) => a !== -1)).toBe(true);
  });
});

describe("seededRandom", () => {
  it("produces deterministic output", () => {
    const rng1 = seededRandom(42);
    const rng2 = seededRandom(42);
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("produces different output for different seeds", () => {
    const rng1 = seededRandom(1);
    const rng2 = seededRandom(2);
    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());
    expect(values1).not.toEqual(values2);
  });

  it("returns values between 0 and 1", () => {
    const rng = seededRandom(99);
    for (let i = 0; i < 100; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe("clamp", () => {
  it("clamps below minimum", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps above maximum", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("passes through values in range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe("formatMs", () => {
  it("formats zero", () => {
    expect(formatMs(0)).toBe("0:00");
  });

  it("formats seconds", () => {
    expect(formatMs(45000)).toBe("0:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatMs(125000)).toBe("2:05");
  });
});

describe("parseCriteria", () => {
  it("parses valid JSON array", () => {
    expect(parseCriteria('["a","b"]')).toEqual(["a", "b"]);
  });

  it("returns empty for null", () => {
    expect(parseCriteria("")).toEqual([]);
  });

  it("returns empty for invalid JSON", () => {
    expect(parseCriteria("not json")).toEqual([]);
  });
});
