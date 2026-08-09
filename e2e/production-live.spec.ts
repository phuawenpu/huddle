import {
  chromium,
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const RUN_PRODUCTION_LIVE = process.env.RUN_PRODUCTION_LIVE === "1";
const BASE_URL = process.env.BASE_URL || "";
const SCENARIO_ID = process.env.PRODUCTION_LIVE_SCENARIO_ID || "";
const FAKE_AUDIO_FILE = process.env.PRODUCTION_LIVE_AUDIO_FILE || "";
const MAX_SPEECH_WER = numericEnv("MAX_SPEECH_WER", 0.45);
const MAX_SPEAKER_ATTRIBUTED_WER = numericEnv(
  "MAX_SPEAKER_ATTRIBUTED_WER",
  0.75,
);
const MAX_NON_OVERLAP_DER = numericEnv("MAX_NON_OVERLAP_DER", 0.75);
const MAX_OVERLAP_SA_WER = numericEnv("MAX_OVERLAP_SA_WER", 1.5);
const ACTIVE_SESSION_IDS = new Set<string>();

type PersistedTurn = {
  currentText: string;
  isFinal: boolean;
  providerSpeakerLabel: string;
  possibleOverlap: boolean;
};

type SpeechEvaluationResponse = {
  report: {
    reference: {
      speakerCount: number;
      overlapIntervals: Array<{ startMs: number; endMs: number }>;
      overlapSpeakerMs: number;
    };
    hypothesis: {
      turnCount: number;
      speakerLabelCount: number;
      unknownWordCount: number;
    };
    speakerMapping: Array<{
      hypothesisLabel: string;
      referenceSpeakerName: string;
    }>;
    wordError: {
      overall: { rate: number | null };
      speakerAttributed: { rate: number | null };
      overlap: { rate: number | null };
      overlapSpeakerAttributed: { rate: number | null };
    };
    diarization: {
      excludingOverlap: {
        errorRate: number | null;
        missedSpeechMs: number;
        falseAlarmMs: number;
        speakerConfusionMs: number;
      };
      includingOverlap: { errorRate: number | null };
    };
  };
};

test.describe("Production live audio verification", () => {
  test.describe.configure({ mode: "serial", retries: 0 });
  test.skip(
    !RUN_PRODUCTION_LIVE,
    "Set RUN_PRODUCTION_LIVE=1 to authorize production session writes.",
  );

  test.beforeAll(() => {
    expect(BASE_URL).toBe("https://huddle-ti5ikw.fly.dev");
    expect(SCENARIO_ID).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test.afterEach(async ({ request }) => {
    for (const sessionId of ACTIVE_SESSION_IDS) {
      await request.post(`/api/sessions/${sessionId}/terminate`);
    }
    ACTIVE_SESSION_IDS.clear();
  });

  test("approved recording reaches live ASR through its first overlap", async ({
    page,
    request,
  }) => {
    test.setTimeout(210_000);
    const scenarioResponse = await request.get(`/api/scenarios/${SCENARIO_ID}`);
    expect(scenarioResponse.ok()).toBeTruthy();
    const scenario = (await scenarioResponse.json()) as {
      turns: Array<{ text: string; endMs?: number }>;
    };
    const firstOverlapTarget = scenario.turns.find((turn) =>
      turn.text.toLowerCase().includes("uncertainty label"),
    );
    expect(firstOverlapTarget?.endMs).toBeGreaterThan(0);
    const session = await createSession(request, {
      title: "Production Climate recorded-pipeline verification",
      runMode: "sim_injected",
      scenarioId: SCENARIO_ID,
    });

    await page.goto(`/facilitator/${session.id}`);
    await page.getByRole("button", { name: "Start Recorded Demo" }).click();
    await expectPipelineReady(page);

    const turns = await waitForTurns(
      request,
      session.id,
      (current) => {
        const transcript = current
          .filter((turn) => turn.isFinal)
          .map((turn) => turn.currentText.toLowerCase())
          .join(" ");
        return transcript.includes("uncertainty label");
      },
      175_000,
    );

    const finalTurns = turns.filter((turn) => turn.isFinal);
    const speakerLabels = new Set(
      finalTurns
        .map((turn) => turn.providerSpeakerLabel)
        .filter((label) => label && label !== "UNKNOWN" && label !== "PENDING"),
    );
    expect(finalTurns.length).toBeGreaterThanOrEqual(8);
    expect(speakerLabels.size).toBeGreaterThanOrEqual(2);
    expect(finalTurns.map((turn) => turn.currentText).join(" ")).toMatch(
      /planner|climate|map/i,
    );
    await expect(page.getByText(/Audio capture error|ASR error/)).toHaveCount(
      0,
    );

    await stopSession(page, request, session.id);
    const evaluation = await evaluateSpeechSession(
      request,
      session.id,
      firstOverlapTarget!.endMs!,
    );
    expect(evaluation.report.reference.speakerCount).toBe(3);
    expect(evaluation.report.reference.overlapIntervals.length).toBeGreaterThan(
      0,
    );
    expect(evaluation.report.reference.overlapSpeakerMs).toBeGreaterThan(0);
    expect(evaluation.report.hypothesis.turnCount).toBeGreaterThanOrEqual(8);
    expect(
      evaluation.report.hypothesis.speakerLabelCount,
    ).toBeGreaterThanOrEqual(2);
    expect(evaluation.report.speakerMapping.length).toBeGreaterThanOrEqual(2);
    expectRateAtMost(
      "overall WER",
      evaluation.report.wordError.overall.rate,
      MAX_SPEECH_WER,
    );
    expectRateAtMost(
      "speaker-attributed WER",
      evaluation.report.wordError.speakerAttributed.rate,
      MAX_SPEAKER_ATTRIBUTED_WER,
    );
    expectRateAtMost(
      "speaker-attributed overlap WER",
      evaluation.report.wordError.overlapSpeakerAttributed.rate,
      MAX_OVERLAP_SA_WER,
    );
    expectRateAtMost(
      "non-overlap DER",
      evaluation.report.diarization.excludingOverlap.errorRate,
      MAX_NON_OVERLAP_DER,
    );
    console.log(
      JSON.stringify({
        source: "recorded_demo",
        sessionId: session.id,
        finalizedTurns: finalTurns.length,
        speakerLabels: [...speakerLabels],
        reachedFirstPlannedOverlap: true,
        lastFinalText: finalTurns.at(-1)?.currentText,
        speechEvaluation: {
          overallWer: evaluation.report.wordError.overall.rate,
          speakerAttributedWer:
            evaluation.report.wordError.speakerAttributed.rate,
          overlapWer: evaluation.report.wordError.overlap.rate,
          overlapSpeakerAttributedWer:
            evaluation.report.wordError.overlapSpeakerAttributed.rate,
          derExcludingOverlap:
            evaluation.report.diarization.excludingOverlap.errorRate,
          derIncludingOverlap:
            evaluation.report.diarization.includingOverlap.errorRate,
          diarizationComponents: evaluation.report.diarization.excludingOverlap,
          speakerMapping: evaluation.report.speakerMapping,
        },
      }),
    );
  });

  test("microphone path ingests the approved recording as a fake device", async ({
    request,
  }) => {
    test.setTimeout(105_000);
    test.skip(
      !FAKE_AUDIO_FILE,
      "Set PRODUCTION_LIVE_AUDIO_FILE to a local WAV used as fake microphone input.",
    );
    const session = await createSession(request, {
      title: "Production Climate microphone-pipeline verification",
      runMode: "live",
    });
    const browser = await chromium.launch({
      headless: true,
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${FAKE_AUDIO_FILE}`,
        "--autoplay-policy=no-user-gesture-required",
      ],
    });

    try {
      const context = await browser.newContext({ permissions: ["microphone"] });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/facilitator/${session.id}`);
      await page.getByRole("button", { name: "Start Mic" }).click();
      await expectPipelineReady(page);

      const turns = await waitForTurns(
        request,
        session.id,
        (current) =>
          current.some(
            (turn) =>
              turn.isFinal &&
              turn.currentText.trim().split(/\s+/).length >= 5 &&
              /alex|ready|review|planner/i.test(turn.currentText),
          ),
        75_000,
      );
      const finalTurns = turns.filter((turn) => turn.isFinal);
      expect(finalTurns.length).toBeGreaterThan(0);
      await expect(page.getByText(/Audio capture error|ASR error/)).toHaveCount(
        0,
      );

      await stopSession(page, request, session.id);
      console.log(
        JSON.stringify({
          source: "microphone",
          sessionId: session.id,
          finalizedTurns: finalTurns.length,
          firstFinalText: finalTurns[0]?.currentText,
        }),
      );
      await context.close();
    } finally {
      await browser.close();
    }
  });
});

async function createSession(
  request: APIRequestContext,
  values: {
    title: string;
    runMode: "sim_injected" | "live";
    scenarioId?: string;
  },
) {
  const response = await request.post("/api/sessions", {
    data: {
      title: values.title,
      objective: "Verify the deployed browser audio and transcription pipeline",
      phase: "evaluate",
      criteria: ["Capture health", "Diarized transcript persistence"],
      speakerCount: 3,
      runMode: values.runMode,
      scenarioId: values.scenarioId,
    },
  });
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  ACTIVE_SESSION_IDS.add(body.id);
  return body as { id: string };
}

async function evaluateSpeechSession(
  request: APIRequestContext,
  sessionId: string,
  endMs: number,
): Promise<SpeechEvaluationResponse> {
  const response = await request.get(
    `/api/sessions/${sessionId}/speech-evaluation?startMs=0&endMs=${Math.round(endMs)}&collarMs=250`,
  );
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body as SpeechEvaluationResponse;
}

function expectRateAtMost(
  label: string,
  rate: number | null,
  threshold: number,
) {
  expect(rate, `${label} was not measurable`).not.toBeNull();
  expect(Number.isFinite(rate), `${label} was not finite`).toBeTruthy();
  expect(rate!, `${label} exceeded ${threshold}`).toBeLessThanOrEqual(
    threshold,
  );
}

function numericEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return parsed;
}

async function expectPipelineReady(page: Page) {
  await expect(page.getByText("Worklet ✓")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("PCM ✓")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("ASR ✓")).toBeVisible({ timeout: 20_000 });
}

async function waitForTurns(
  request: APIRequestContext,
  sessionId: string,
  complete: (turns: PersistedTurn[]) => boolean,
  timeoutMs: number,
): Promise<PersistedTurn[]> {
  const deadline = Date.now() + timeoutMs;
  let latest: PersistedTurn[] = [];
  while (Date.now() < deadline) {
    const response = await request.get(`/api/sessions/${sessionId}/turns`);
    expect(response.ok()).toBeTruthy();
    latest = (await response.json()) as PersistedTurn[];
    if (complete(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(
    `Timed out waiting for production transcript; latest=${JSON.stringify(latest)}`,
  );
}

async function stopSession(
  page: Page,
  request: APIRequestContext,
  sessionId: string,
) {
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: "Ended" })).toBeVisible({
    timeout: 15_000,
  });
  await expect
    .poll(async () => {
      const response = await request.get(`/api/sessions/${sessionId}`);
      const body = await response.json();
      return body.status;
    })
    .toBe("terminated");
}
