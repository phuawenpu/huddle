import { mkdtemp, readFile, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { synthesizeScenarioAudio } from "@/lib/audio-pipeline";
import { validateRenderedSpeech } from "@/lib/audio-validation";
import { PRECONFIGURED_SCENARIOS } from "@/lib/preconfigured-scenarios";
import { createDefaultCasting } from "@/lib/voice-casting";

let temporaryDirectory: string | undefined;
const previousAssetDir = process.env.ASSET_DIR;
const previousStub = process.env.TTS_STUB;

afterEach(async () => {
  process.env.ASSET_DIR = previousAssetDir;
  process.env.TTS_STUB = previousStub;
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
  }
});

describe("multi-speaker audio pipeline", () => {
  it("renders distinct clips, schedules them, and produces real WAV and MP3 outputs", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "huddle-audio-"));
    process.env.ASSET_DIR = temporaryDirectory;
    process.env.TTS_STUB = "1";
    const scenarioId = "pipeline-test";

    const manifest = await synthesizeScenarioAudio({
      scenarioId,
      speakers: createDefaultCasting(3),
      turns: [
        {
          id: "t0",
          index: 0,
          speakerIndex: 0,
          text: "I am listening for evidence.",
          isCalibration: true,
          pauseBeforeMs: 200,
        },
        {
          id: "t1",
          index: 1,
          speakerIndex: 1,
          text: "I will watch the interaction flow.",
          isCalibration: true,
          pauseBeforeMs: 200,
        },
        {
          id: "t2",
          index: 2,
          speakerIndex: 2,
          text: "I will focus on operational constraints.",
          isCalibration: true,
          pauseBeforeMs: 200,
        },
        {
          id: "t3",
          index: 3,
          speakerIndex: 0,
          text: "The recovery step is still unclear.",
          pauseBeforeMs: 300,
        },
        {
          id: "t4",
          index: 4,
          speakerIndex: 2,
          text: "Before changing it, we should check where recovery actually fails.",
          pauseBeforeMs: 380,
        },
        {
          id: "t5",
          index: 5,
          speakerIndex: 0,
          text: "The timeout cases are the ones I can bring into the next test.",
          pauseBeforeMs: 260,
        },
        {
          id: "t6",
          index: 6,
          speakerIndex: 1,
          text: "Right—the missing recovery cue.",
          pauseBeforeMs: 0,
          overlap: {
            withTurnId: "t5",
            startBeforeEndMs: 420,
            kind: "eager_agreement",
            resolution: "continue",
          },
        },
      ],
    });

    const wavPath = join(temporaryDirectory, scenarioId, "mixed.wav");
    const mp3Path = join(temporaryDirectory, scenarioId, "mixed.mp3");
    const wav = await readFile(wavPath);
    const mp3 = await readFile(mp3Path);
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(mp3.subarray(0, 4).toString()).not.toBe("RIFF");
    expect((await stat(wavPath)).size).toBeGreaterThan(10_000);
    expect((await stat(mp3Path)).size).toBeGreaterThan(1_000);
    expect(manifest.version).toBe(2);
    expect(manifest.transcriptFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.turns).toHaveLength(7);
    expect(manifest.turns[1].scheduledStartMs).toBeGreaterThan(
      manifest.turns[0].scheduledEndMs,
    );
    expect(manifest.turns[6].scheduledStartMs).toBeLessThan(
      manifest.turns[5].scheduledEndMs,
    );
    expect(manifest.turns[6].overlapMs).toBeGreaterThan(0);
    expect(manifest.durationMs).toBeGreaterThan(3_000);
    const validation = await validateRenderedSpeech(manifest);
    expect(validation).toMatchObject({
      method: "tone_fixture",
      passed: true,
      speechExpected: false,
    });
    expect(
      await stat(join(temporaryDirectory, scenarioId, "validation.json")),
    ).toBeTruthy();
  }, 60_000);

  it("renders the Housing Renewal preset with its early minimal overlap", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "huddle-housing-audio-"));
    process.env.ASSET_DIR = temporaryDirectory;
    process.env.TTS_STUB = "1";
    const scenario = PRECONFIGURED_SCENARIOS.find(
      ({ id }) => id === "preset-v1-resident-led-shared-spaces",
    );
    expect(scenario).toBeTruthy();

    const manifest = await synthesizeScenarioAudio({
      scenarioId: scenario!.id,
      speakers: scenario!.speakers,
      turns: scenario!.turns,
    });

    expect(manifest.turns.some(({ overlapMs }) => overlapMs > 0)).toBe(true);
    expect(manifest.durationMs).toBeGreaterThan(0);
  }, 60_000);
});
