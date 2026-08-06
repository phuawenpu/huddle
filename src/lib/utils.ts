// ============================================
// Critique HUD — Utilities
// ============================================

/**
 * Determine if a turn is "substantive" (worth analyzing).
 * Rules from spec §2.2: ≥ 4 words OR ≥ 1.2 s, not a bare acknowledgement.
 */
export function isSubstantiveTurn(text: string, durationMs: number): boolean {
  const cleaned = text.trim().toLowerCase();
  // Bare acknowledgements
  const bareAcks = new Set([
    "ok", "okay", "yes", "yeah", "no", "right", "sure", "thanks",
    "thank you", "got it", "hmm", "uh-huh", "mhm", "i see", "agreed",
    "alright", "fine", "good", "great", "cool", "nice",
  ]);
  if (bareAcks.has(cleaned) || cleaned.length <= 3) return false;

  const wordCount = cleaned.split(/\s+/).filter(w => w.length > 0).length;
  const durationSeconds = durationMs / 1000;

  return wordCount >= 4 || durationSeconds >= 1.2;
}

/**
 * Word error rate (WER) between reference and hypothesis strings.
 */
export function wordErrorRate(reference: string, hypothesis: string): number {
  const refWords = reference.trim().toLowerCase().split(/\s+/);
  const hypWords = hypothesis.trim().toLowerCase().split(/\s+/);

  if (refWords.length === 0) return hypWords.length === 0 ? 0 : 1;

  const m = refWords.length;
  const n = hypWords.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = refWords[i - 1] === hypWords[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }

  return d[m][n] / m;
}

/**
 * Hungarian algorithm for optimal assignment. Returns [row → col] mapping.
 * Costs matrix: costMatrix[row][col].
 */
export function hungarianMatch(costMatrix: number[][]): number[] {
  const n = costMatrix.length;
  if (n === 0) return [];
  const m = costMatrix[0]?.length || 0;

  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity);
    const used = new Array(m + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= m; j++) {
        if (!used[j]) {
          const cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }

      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const assignment = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) {
    if (p[j] > 0) {
      assignment[p[j] - 1] = j - 1;
    }
  }
  return assignment;
}

/**
 * Generate a seeded pseudo-random number (mulberry32).
 */
export function seededRandom(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate a short unique ID.
 */
export function shortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Format milliseconds as mm:ss.
 */
export function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Parse criteria JSON string to array, safely.
 */
export function parseCriteria(criteria: string): string[] {
  try {
    const parsed = JSON.parse(criteria);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
