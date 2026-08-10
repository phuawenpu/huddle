export interface SpeakerVisualStyle {
  name: string;
  color: string;
  softColor: string;
  marker: string;
}

export interface SpeakerTimelineTurn {
  id?: string;
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
    name: "violet",
    color: "#c084fc",
    softColor: "rgba(192, 132, 252, 0.22)",
    marker: "A",
  },
  {
    name: "green",
    color: "#86ef6b",
    softColor: "rgba(134, 239, 107, 0.2)",
    marker: "B",
  },
  {
    name: "orange",
    color: "#fb923c",
    softColor: "rgba(251, 146, 60, 0.22)",
    marker: "C",
  },
  {
    name: "cyan",
    color: "#22d3ee",
    softColor: "rgba(34, 211, 238, 0.22)",
    marker: "D",
  },
  {
    name: "pink",
    color: "#f472b6",
    softColor: "rgba(244, 114, 182, 0.22)",
    marker: "E",
  },
  {
    name: "blue",
    color: "#60a5fa",
    softColor: "rgba(96, 165, 250, 0.22)",
    marker: "F",
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
  const providerLabel = normalized.match(/^(?:speaker\s+)?([a-z])$/i)?.[1];
  if (providerLabel) {
    return SPEAKER_PALETTE[
      (providerLabel.toUpperCase().charCodeAt(0) - 65) % SPEAKER_PALETTE.length
    ];
  }
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

export function rollingTalkShares(
  turns: readonly SpeakerTimelineTurn[],
  labels: readonly string[],
  throughMs: number,
  windowMs = 5 * 60 * 1_000,
): Record<string, number> {
  const normalizedLabels = [
    ...new Set(labels.filter((label) => !isUnknownSpeakerLabel(label))),
  ];
  const windowEnd = Math.max(0, throughMs);
  const windowStart = Math.max(0, windowEnd - Math.max(1, windowMs));
  const durations = Object.fromEntries(
    normalizedLabels.map((label) => [label, 0]),
  );

  for (const turn of turns) {
    if (isUnknownSpeakerLabel(turn.providerSpeakerLabel)) continue;
    const start = Math.max(windowStart, Math.max(0, turn.startMs));
    const end = Math.min(windowEnd, Math.max(turn.startMs, turn.endMs));
    if (end <= start) continue;
    durations[turn.providerSpeakerLabel] =
      (durations[turn.providerSpeakerLabel] || 0) + (end - start);
  }

  const total = Object.values(durations).reduce(
    (sum, duration) => sum + duration,
    0,
  );
  return Object.fromEntries(
    normalizedLabels.map((label) => [
      label,
      total > 0 ? durations[label] / total : 0,
    ]),
  );
}

export function speakerInitial(name: string, fallbackLabel: string): string {
  const initial = name.trim().match(/[\p{L}\p{N}]/u)?.[0];
  return (initial || fallbackLabel.trim().charAt(0) || "?").toUpperCase();
}

function stableSpeakerHash(label: string): number {
  let hash = 2166136261;
  for (let index = 0; index < label.length; index++) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
