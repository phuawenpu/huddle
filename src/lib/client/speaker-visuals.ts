export interface SpeakerVisualStyle {
  name: string;
  color: string;
  softColor: string;
  marker: string;
}

export interface SpeakerTimelineTurn {
  providerSpeakerLabel: string;
  startMs: number;
  endMs: number;
  isUnknownSpeaker?: boolean;
  possibleOverlap?: boolean;
}

export const UNKNOWN_SPEAKER_STYLE: SpeakerVisualStyle = {
  name: "pending",
  color: "#94a3b8",
  softColor: "rgba(148, 163, 184, 0.22)",
  marker: "○",
};

export const SPEAKER_PALETTE: readonly SpeakerVisualStyle[] = [
  {
    name: "cyan",
    color: "#22d3ee",
    softColor: "rgba(34, 211, 238, 0.22)",
    marker: "●",
  },
  {
    name: "amber",
    color: "#fbbf24",
    softColor: "rgba(251, 191, 36, 0.22)",
    marker: "◆",
  },
  {
    name: "violet",
    color: "#c084fc",
    softColor: "rgba(192, 132, 252, 0.22)",
    marker: "■",
  },
  {
    name: "lime",
    color: "#a3e635",
    softColor: "rgba(163, 230, 53, 0.22)",
    marker: "▲",
  },
  {
    name: "pink",
    color: "#f472b6",
    softColor: "rgba(244, 114, 182, 0.22)",
    marker: "✦",
  },
  {
    name: "blue",
    color: "#60a5fa",
    softColor: "rgba(96, 165, 250, 0.22)",
    marker: "⬟",
  },
];

export function isUnknownSpeakerLabel(label?: string | null): boolean {
  const normalized = String(label || "")
    .trim()
    .toUpperCase();
  return (
    !normalized ||
    normalized === "UNKNOWN" ||
    normalized === "PENDING" ||
    normalized === "UNASSIGNED"
  );
}

/**
 * Assign a stable session-local style. Provider labels normally arrive as A, B,
 * C, so sorted assignment keeps adjacent labels distinct and predictable. The
 * label and marker remain visible because color alone is not an identity.
 */
export function speakerVisualStyle(
  label: string | null | undefined,
  labels: readonly string[],
): SpeakerVisualStyle {
  if (isUnknownSpeakerLabel(label)) return UNKNOWN_SPEAKER_STYLE;
  const normalized = String(label).trim();
  const ordered = [
    ...new Set(labels.filter((value) => !isUnknownSpeakerLabel(value))),
  ]
    .map((value) => value.trim())
    .sort((left, right) => left.localeCompare(right));
  const index = ordered.indexOf(normalized);
  const fallbackIndex = stableSpeakerHash(normalized) % SPEAKER_PALETTE.length;
  return SPEAKER_PALETTE[
    (index >= 0 ? index : fallbackIndex) % SPEAKER_PALETTE.length
  ];
}

export function speakerAtTime(
  atMs: number,
  provisionalLabel: string | null | undefined,
  turns: readonly SpeakerTimelineTurn[],
): { label: string | null; possibleOverlap: boolean } {
  const matches = turns.filter(
    (turn) =>
      !turn.isUnknownSpeaker &&
      atMs >= Math.max(0, turn.startMs) &&
      atMs <= Math.max(turn.startMs, turn.endMs),
  );
  const selected = matches.at(-1);
  return {
    label: selected?.providerSpeakerLabel || provisionalLabel || null,
    possibleOverlap:
      matches.length > 1 || matches.some((turn) => turn.possibleOverlap),
  };
}

function stableSpeakerHash(label: string): number {
  let hash = 2166136261;
  for (let index = 0; index < label.length; index++) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
