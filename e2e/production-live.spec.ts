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
const ACTIVE_SESSION_IDS = new Set<string>();

type PersistedTurn = {
  currentText: string;
  isFinal: boolean;
  providerSpeakerLabel: string;
  possibleOverlap: boolean;
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
    console.log(
      JSON.stringify({
        source: "recorded_demo",
        sessionId: session.id,
        finalizedTurns: finalTurns.length,
        speakerLabels: [...speakerLabels],
        reachedFirstPlannedOverlap: true,
        lastFinalText: finalTurns.at(-1)?.currentText,
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
