import { createHash } from "crypto";
import { execFile } from "child_process";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import type { ScenarioSpeaker, ScenarioTurn } from "./types";
import { validateOverlapRules } from "./overlap";
import { createTtsProvider } from "./tts";

const execFileAsync = promisify(execFile);

export interface RenderedTurn {
  id: string;
  index: number;
  speakerIndex: number;
  text: string;
  file: string;
  renderKey: string;
  checksum: string;
  durationMs: number;
  scheduledStartMs: number;
  scheduledEndMs: number;
  pauseBeforeMs: number;
  overlapMs: number;
  isCalibration: boolean;
}

export interface AudioManifest {
  version: 1;
  scenarioId: string;
  ttsModel: string;
  stubbed: boolean;
  sampleRate: 16000;
  channels: 1;
  durationMs: number;
  overlapRatioPct: number;
  createdAt: string;
  turns: RenderedTurn[];
  outputs: {
    wav: string;
    mp3: string;
    wavBytes: number;
    mp3Bytes: number;
  };
}

function assetRoot(): string {
  return process.env.ASSET_DIR || join(process.cwd(), "data", "audio");
}

export async function synthesizeScenarioAudio(input: {
  scenarioId: string;
  speakers: ScenarioSpeaker[];
  turns: ScenarioTurn[];
}): Promise<AudioManifest> {
  if (!input.turns.length) throw new Error("Scenario has no turns to synthesize.");
  if (!input.speakers.length) throw new Error("Scenario has no voice cast.");

  const scenarioDir = join(assetRoot(), input.scenarioId);
  const clipsDir = join(scenarioDir, "turns");
  await mkdir(clipsDir, { recursive: true });
  const provider = createTtsProvider();
  const failures: Array<{ turn: number; reason: string }> = [];
  const rendered = new Array<RenderedTurn>(input.turns.length);

  await mapConcurrent(input.turns, 4, async (turn, index) => {
    try {
      const speaker = input.speakers.find(
        (candidate) => candidate.index === turn.speakerIndex
      );
      if (!speaker) throw new Error(`No cast found for speaker ${turn.speakerIndex}`);
      const id = turn.id || `t${index}`;
      const turnInstructions = composeTurnInstructions(
        speaker.instructions || "",
        turn,
        input.turns[index - 1]
      );
      const renderKey = createHash("sha256")
        .update(
          [
            turn.text,
            speaker.voiceId,
            turnInstructions,
            speaker.speakingRate || 1,
            "wav",
            process.env.TTS_MODEL || "gpt-4o-mini-tts",
          ].join("\u0000")
        )
        .digest("hex");
      const clipFile = join(clipsDir, `${id}.wav`);
      const metaFile = join(clipsDir, `${id}.json`);
      let durationMs: number | undefined;

      if (existsSync(clipFile) && existsSync(metaFile)) {
        try {
          const cached = JSON.parse(await readFile(metaFile, "utf8"));
          if (cached.renderKey === renderKey) durationMs = cached.durationMs;
        } catch {
          // A corrupt cache entry is simply regenerated.
        }
      }

      if (!durationMs) {
        const raw = await provider.synthesize({
          text: turn.text,
          voiceId: speaker.voiceId,
          instructions: turnInstructions,
          speakingRate: speaker.speakingRate,
          format: "wav",
        });
        const rawFile = join(clipsDir, `${id}.raw.wav`);
        const pendingFile = join(clipsDir, `${id}.pending.wav`);
        if (process.env.TTS_STUB === "1") {
          await writeFile(clipFile, raw.bytes);
          durationMs = Math.round(
            ((raw.bytes.length - 44) / 2 / 16_000) * 1000
          );
        } else {
          await writeFile(rawFile, raw.bytes);
          await execFileAsync("ffmpeg", [
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            rawFile,
            "-af",
            "silenceremove=start_periods=1:start_duration=0.02:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-50dB,areverse,alimiter=limit=0.707",
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            pendingFile,
          ]);
          await rename(pendingFile, clipFile);
          await unlink(rawFile).catch(() => {});
          durationMs = await probeDurationMs(clipFile);
        }
        await writeFile(
          metaFile,
          JSON.stringify({ renderKey, durationMs }, null, 2)
        );
      }

      const bytes = await readFile(clipFile);
      rendered[index] = {
        id,
        index,
        speakerIndex: turn.speakerIndex,
        text: turn.text,
        file: `turns/${id}.wav`,
        renderKey,
        checksum: createHash("sha256").update(bytes).digest("hex"),
        durationMs,
        scheduledStartMs: 0,
        scheduledEndMs: 0,
        pauseBeforeMs: Math.max(
          0,
          turn.pauseBeforeMs ?? (turn.isCalibration ? 1200 : 420)
        ),
        overlapMs: turn.overlap?.startOffsetMs || 0,
        isCalibration: Boolean(turn.isCalibration),
      };
    } catch (error: any) {
      failures.push({ turn: index, reason: error?.message || String(error) });
    }
  });

  if (failures.length) {
    throw new Error(
      `Failed to render ${failures.length} turn(s): ${failures
        .slice(0, 5)
        .map((failure) => `#${failure.turn} ${failure.reason}`)
        .join("; ")}`
    );
  }

  scheduleTurns(rendered, input.turns);
  validateSchedule(rendered, input.turns);

  const mixedWav = join(scenarioDir, "mixed.wav");
  const mixedMp3 = join(scenarioDir, "mixed.mp3");
  await mixTurns(scenarioDir, rendered, mixedWav);
  await execFileAsync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    mixedWav,
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "128k",
    mixedMp3,
  ]);

  const durationMs = await probeDurationMs(mixedWav);
  const overlapMs = rendered.reduce((sum, turn) => sum + turn.overlapMs, 0);
  const speechMs = rendered.reduce((sum, turn) => sum + turn.durationMs, 0);
  const wavStat = await stat(mixedWav);
  const mp3Stat = await stat(mixedMp3);
  const manifest: AudioManifest = {
    version: 1,
    scenarioId: input.scenarioId,
    ttsModel: process.env.TTS_MODEL || "gpt-4o-mini-tts",
    stubbed: process.env.TTS_STUB === "1",
    sampleRate: 16000,
    channels: 1,
    durationMs,
    overlapRatioPct:
      speechMs > 0 ? Math.round((overlapMs / speechMs) * 10_000) / 100 : 0,
    createdAt: new Date().toISOString(),
    turns: rendered,
    outputs: {
      wav: "mixed.wav",
      mp3: "mixed.mp3",
      wavBytes: wavStat.size,
      mp3Bytes: mp3Stat.size,
    },
  };
  await writeFile(
    join(scenarioDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  return manifest;
}

function composeTurnInstructions(
  speakerInstructions: string,
  turn: ScenarioTurn,
  previous?: ScenarioTurn
): string {
  const directions: string[] = [speakerInstructions];
  if (turn.isCalibration) {
    directions.push(
      "This is a brief microphone calibration introduction. Sound relaxed and self-introducing, with no dramatic emphasis."
    );
  } else if (previous) {
    directions.push(
      `The previous participant just said: “${previous.text.slice(0, 180)}” Do not repeat or speak that quotation. Deliver the input as an immediate, attentive response to it.`
    );
  }
  if (turn.overlap?.kind === "interruption") {
    directions.push(
      "Enter quickly as a constructive interruption, already engaged with the point; do not pause before the first word."
    );
  } else if (turn.overlap?.kind === "eager_agreement") {
    directions.push(
      "Come in with spontaneous recognition, then make the added point distinctly."
    );
  } else if (turn.overlap?.kind === "backchannel") {
    directions.push(
      "This is a quiet, natural backchannel under another speaker, not a standalone announcement."
    );
  } else if (turn.expectedCategory === "questions") {
    directions.push(
      "Ask this as a genuine question whose answer could change your view."
    );
  } else if (turn.expectedCategory === "decisions") {
    directions.push(
      "Sound tentative enough to invite correction; this decision is emerging from discussion, not being proclaimed."
    );
  } else if (turn.expectedCategory === "actions") {
    directions.push(
      "Make the commitment concrete and conversational, without sales or presentation cadence."
    );
  }
  return directions.filter(Boolean).join(" ");
}

function scheduleTurns(
  rendered: RenderedTurn[],
  sourceTurns: ScenarioTurn[]
): void {
  let previousEnd = 0;
  for (let index = 0; index < rendered.length; index++) {
    const turn = rendered[index];
    const source = sourceTurns[index];
    const pause = index === 0 ? 2000 : turn.pauseBeforeMs;
    const overlap = source.overlap ? turn.overlapMs : 0;
    turn.scheduledStartMs = Math.max(0, previousEnd + pause - overlap);
    turn.scheduledEndMs = turn.scheduledStartMs + turn.durationMs;
    previousEnd = turn.scheduledEndMs;
  }
}

function validateSchedule(
  rendered: RenderedTurn[],
  sourceTurns: ScenarioTurn[]
): void {
  const scheduled: ScenarioTurn[] = rendered.map((turn, index) => {
    const overlapWith =
      sourceTurns[index].overlap && index > 0 ? [index - 1] : undefined;
    return {
      ...sourceTurns[index],
      index,
      startMs: turn.scheduledStartMs,
      endMs: turn.scheduledEndMs,
      overlapWith,
    };
  });
  for (let index = 1; index < scheduled.length; index++) {
    if (scheduled[index].overlapWith) {
      scheduled[index - 1].overlapWith = [
        ...(scheduled[index - 1].overlapWith || []),
        index,
      ];
    }
  }
  const calibration = scheduled
    .filter((turn) => turn.isCalibration)
    .map((turn) => turn.index);
  const validation = validateOverlapRules(scheduled, calibration);
  if (!validation.valid) {
    throw new Error(
      `Overlap schedule is invalid: ${validation.violations
        .map((violation) => violation.detail)
        .join("; ")}`
    );
  }
  for (let index = 1; index < scheduled.length; index++) {
    if (
      scheduled[index].startMs! < scheduled[index - 1].endMs! &&
      scheduled[index].speakerIndex === scheduled[index - 1].speakerIndex
    ) {
      throw new Error(`Speaker ${scheduled[index].speakerIndex} overlaps themself.`);
    }
  }
}

async function mixTurns(
  scenarioDir: string,
  turns: RenderedTurn[],
  output: string
): Promise<void> {
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  for (const turn of turns) args.push("-i", join(scenarioDir, turn.file));
  const filters = turns.map(
    (turn, index) =>
      `[${index}:a]adelay=${turn.scheduledStartMs}:all=1[a${index}]`
  );
  const inputs = turns.map((_, index) => `[a${index}]`).join("");
  filters.push(
    `${inputs}amix=inputs=${turns.length}:normalize=0:dropout_transition=0,alimiter=limit=0.92,loudnorm=I=-18:TP=-2:LRA=11[out]`
  );
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    output
  );
  await execFileAsync("ffmpeg", args, { maxBuffer: 8 * 1024 * 1024 });
}

async function probeDurationMs(file: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const duration = Number(String(stdout).trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not measure audio duration for ${file}`);
  }
  return Math.round(duration * 1000);
}

async function mapConcurrent<T>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++;
        await worker(values[index], index);
      }
    })
  );
}
