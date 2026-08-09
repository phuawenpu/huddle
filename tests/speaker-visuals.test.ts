import { describe, expect, it } from "vitest";
import {
  SPEAKER_PALETTE,
  UNKNOWN_SPEAKER_STYLE,
  isUnknownSpeakerLabel,
  speakerAtTime,
  speakerVisualStyle,
} from "@/lib/client/speaker-visuals";

describe("speaker visuals", () => {
  it("assigns distinct, stable styles to the common provider labels", () => {
    const labels = ["C", "A", "B"];
    const styles = ["A", "B", "C"].map((label) =>
      speakerVisualStyle(label, labels),
    );

    expect(new Set(styles.map((style) => style.color)).size).toBe(3);
    expect(speakerVisualStyle("A", labels)).toEqual(styles[0]);
    expect(styles.every((style) => style.marker.length > 0)).toBe(true);
  });

  it("uses the neutral style while attribution is unknown", () => {
    expect(isUnknownSpeakerLabel("PENDING")).toBe(true);
    expect(isUnknownSpeakerLabel("UNKNOWN")).toBe(true);
    expect(isUnknownSpeakerLabel(null)).toBe(true);
    expect(speakerVisualStyle("PENDING", ["A", "B"])).toEqual(
      UNKNOWN_SPEAKER_STYLE,
    );
  });

  it("reconciles provisional samples to finalized speaker timing", () => {
    const turns = [
      { providerSpeakerLabel: "A", startMs: 0, endMs: 900 },
      {
        providerSpeakerLabel: "B",
        startMs: 850,
        endMs: 1_600,
        possibleOverlap: true,
      },
    ];

    expect(speakerAtTime(400, "PENDING", turns)).toEqual({
      label: "A",
      possibleOverlap: false,
    });
    expect(speakerAtTime(875, "A", turns)).toEqual({
      label: "B",
      possibleOverlap: true,
    });
    expect(speakerAtTime(2_000, "C", turns)).toEqual({
      label: "C",
      possibleOverlap: false,
    });
  });

  it("keeps every palette color legible against the dark waveform surface", () => {
    for (const style of SPEAKER_PALETTE) {
      expect(contrastRatio(style.color, "#05070d")).toBeGreaterThanOrEqual(4.5);
    }
  });
});

function contrastRatio(foreground: string, background: string) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (left, right) => right - left,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string) {
  const values = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}
