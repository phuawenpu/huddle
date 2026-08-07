import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { wordErrorRate } from "./utils";
import type { AudioManifest } from "./audio-pipeline";

export interface AudioValidationTurn {
  id: string;
  expected: string;
  transcribed: string;
  wordErrorRate: number;
  passed: boolean;
}
export interface AudioValidationReport {
  version: 1;
  method: "independent_asr" | "tone_fixture";
  model: string | null;
  passed: boolean;
  speechExpected: boolean;
  sampledTurnCount: number;
  averageWordErrorRate: number | null;
  checkedAt: string;
  reason?: string;
  turns: AudioValidationTurn[];
}

function audioRoot() {
  return process.env.ASSET_DIR || join(process.cwd(), "data", "audio");
}

export async function validateRenderedSpeech(
  manifest: AudioManifest
): Promise<AudioValidationReport> {
  if (manifest.stubbed) {
    const report: AudioValidationReport = {
      version: 1,
      method: "tone_fixture",
      model: null,
      passed: true,
      speechExpected: false,
      sampledTurnCount: 0,
      averageWordErrorRate: null,
      checkedAt: new Date().toISOString(),
      reason:
        "TTS_STUB=1 deliberately produces speaker-distinct tones; speech fidelity is not applicable.",
      turns: [],
    };
    await saveReport(manifest.scenarioId, report);
    return report;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Independent audio validation requires OPENAI_API_KEY.");
  }
  const model = process.env.AUDIO_VALIDATION_MODEL || "gpt-4o-mini-transcribe";
  const sampled = selectSample(manifest);
  const turns = await mapConcurrent(sampled, 2, async (turn) => {
    const clip = await readFile(
      join(audioRoot(), manifest.scenarioId, turn.file)
    );
    const form = new FormData();
    form.append("file", new Blob([clip], { type: "audio/wav" }), `${turn.id}.wav`);
    form.append("model", model);
    form.append("response_format", "json");
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      }
    );
    if (!response.ok) {
      throw new Error(
        `Independent ASR returned ${response.status}: ${(await response.text()).slice(0, 240)}`
      );
    }
    const body = await response.json();
    const transcribed = String(body?.text || "").trim();
    const wer = wordErrorRate(turn.text, transcribed);
    return {
      id: turn.id,
      expected: turn.text,
      transcribed,
      wordErrorRate: Math.round(wer * 1000) / 1000,
      passed: Boolean(transcribed) && wer <= 0.35,
    };
  });
  const average =
    turns.reduce((sum, turn) => sum + turn.wordErrorRate, 0) /
    Math.max(1, turns.length);
  const report: AudioValidationReport = {
    version: 1,
    method: "independent_asr",
    model,
    passed:
      turns.length > 0 &&
      average <= 0.2 &&
      turns.every((turn) => turn.passed),
    speechExpected: true,
    sampledTurnCount: turns.length,
    averageWordErrorRate: Math.round(average * 1000) / 1000,
    checkedAt: new Date().toISOString(),
    turns,
  };
  if (!report.passed) {
    report.reason =
      "One or more rendered clips did not independently transcribe close enough to their source text.";
  }
  await saveReport(manifest.scenarioId, report);
  return report;
}

function selectSample(manifest: AudioManifest) {
  const calibration = manifest.turns.filter((turn) => turn.isCalibration);
  const main = manifest.turns.filter((turn) => !turn.isCalibration);
  const sampleCount = Math.min(8, main.length);
  const selectedMain = Array.from({ length: sampleCount }, (_, index) => {
    const position = Math.min(
      main.length - 1,
      Math.floor(((index + 0.5) / sampleCount) * main.length)
    );
    return main[position];
  });
  return [...calibration, ...selectedMain].filter(
    (turn, index, all) => all.findIndex((item) => item.id === turn.id) === index
  );
}

async function saveReport(
  scenarioId: string,
  report: AudioValidationReport
) {
  await writeFile(
    join(audioRoot(), scenarioId, "validation.json"),
    JSON.stringify(report, null, 2)
  );
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++;
        results[index] = await worker(values[index]);
      }
    })
  );
  return results;
}
