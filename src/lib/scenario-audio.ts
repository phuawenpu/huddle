import { existsSync, readFileSync } from "fs";
import { unlink } from "fs/promises";
import { join } from "path";

export function scenarioAudioRoot(): string {
  return process.env.ASSET_DIR || join(process.cwd(), "data", "audio");
}

export function scenarioAudioDirectory(scenarioId: string): string {
  return join(scenarioAudioRoot(), scenarioId);
}

export function hasValidatedScenarioAudio(
  scenarioId: string,
  expectedTranscriptFingerprint?: string
): boolean {
  const directory = scenarioAudioDirectory(scenarioId);
  const manifestPath = join(directory, "manifest.json");
  const validationPath = join(directory, "validation.json");
  if (!existsSync(join(directory, "mixed.wav")) || !existsSync(manifestPath)) {
    return false;
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const validation = JSON.parse(readFileSync(validationPath, "utf8"));
    if (
      expectedTranscriptFingerprint &&
      manifest?.transcriptFingerprint !== expectedTranscriptFingerprint
    ) {
      return false;
    }
    return process.env.TTS_STUB === "1"
      ? validation?.method === "tone_fixture" && validation?.passed === true
      : validation?.method === "independent_asr" &&
          validation?.speechExpected === true &&
          validation?.passed === true;
  } catch {
    return false;
  }
}

/**
 * Remove only derived mix/validation artifacts after a transcript change.
 * Per-turn clips stay in place so unchanged utterances can reuse the TTS cache.
 */
export async function invalidateScenarioAudioMix(scenarioId: string): Promise<void> {
  const directory = scenarioAudioDirectory(scenarioId);
  await Promise.all(
    ["mixed.wav", "mixed.mp3", "manifest.json", "validation.json"].map((file) =>
      unlink(join(directory, file)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      })
    )
  );
}
