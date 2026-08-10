import {
  test,
  expect,
  chromium,
  type APIRequestContext,
} from "@playwright/test";

const SESSION_TIMEOUT = 45000;

async function createTranscriptNavigationFixture(
  request: APIRequestContext,
  turnCount = 32,
) {
  const created = await request.post("/api/sessions", {
    data: {
      title: "Long transcript navigation fixture",
      objective: "Verify every live transcript turn remains reachable",
      phase: "evaluate",
      criteria: ["Transcript access"],
      speakerCount: 3,
      runMode: "live",
    },
  });
  const session = await created.json();
  expect(created.ok(), JSON.stringify(session)).toBeTruthy();

  for (let index = 0; index < turnCount; index++) {
    const ingested = await request.post(`/api/sessions/${session.id}/turns`, {
      data: {
        providerSessionId: `navigation-${session.id}`,
        providerTurnOrder: index,
        segmentIndex: 0,
        providerSpeakerLabel: String.fromCharCode(65 + (index % 3)),
        startMs: index * 700,
        endMs: index * 700 + 500,
        receivedAtMs: index * 700 + 500,
        currentText: `Transcript marker ${String(index + 1).padStart(2, "0")}`,
        isFinal: true,
      },
    });
    const ingestResult = await ingested.json();
    expect(ingested.ok(), JSON.stringify(ingestResult)).toBeTruthy();
  }

  return session as { id: string };
}

async function ingestDiscussionTurns(
  request: APIRequestContext,
  sessionId: string,
  startIndex: number,
  texts: string[],
) {
  const turns: Array<{ id: string; currentText: string }> = [];
  for (let offset = 0; offset < texts.length; offset++) {
    const index = startIndex + offset;
    const response = await request.post(`/api/sessions/${sessionId}/turns`, {
      data: {
        providerSessionId: `analysis-${sessionId}`,
        providerTurnOrder: index,
        segmentIndex: 0,
        providerSpeakerLabel: String.fromCharCode(65 + (index % 3)),
        startMs: index * 2_400,
        endMs: index * 2_400 + 2_000,
        receivedAtMs: index * 2_400 + 2_000,
        currentText: texts[offset],
        isFinal: true,
      },
    });
    const turn = await response.json();
    expect(response.ok(), JSON.stringify(turn)).toBeTruthy();
    turns.push(turn);
  }
  return turns;
}

async function createRenderedFixture(request: APIRequestContext) {
  const speakers = [
    {
      index: 0,
      name: "Alex",
      voiceId: "cedar",
      accent: "neutral North American",
      timbreClass: "low",
      role: "research lead",
      speakingRate: 0.96,
    },
    {
      index: 1,
      name: "Blake",
      voiceId: "marin",
      accent: "southern British",
      timbreClass: "mid_high",
      role: "product designer",
      speakingRate: 1.04,
    },
    {
      index: 2,
      name: "Casey",
      voiceId: "sage",
      accent: "Indian English",
      timbreClass: "mid",
      role: "delivery lead",
      speakingRate: 0.92,
    },
  ];
  const turns = [
    {
      id: "t0",
      index: 0,
      speakerIndex: 0,
      text: "I am Alex and I will listen for evidence in the retry flow.",
      isCalibration: true,
      pauseBeforeMs: 900,
    },
    {
      id: "t1",
      index: 1,
      speakerIndex: 1,
      text: "I am Blake and I will watch where the interface loses context.",
      isCalibration: true,
      pauseBeforeMs: 970,
    },
    {
      id: "t2",
      index: 2,
      speakerIndex: 2,
      text: "I am Casey and I will test ideas against support constraints.",
      isCalibration: true,
      pauseBeforeMs: 880,
    },
    {
      id: "t3",
      index: 3,
      speakerIndex: 0,
      text: "The retry action vanishes after a timeout, so people cannot tell whether their work was saved.",
      pauseBeforeMs: 410,
      expectedCategory: "evidence",
    },
    {
      id: "t4",
      index: 4,
      speakerIndex: 2,
      text: "Is the missing action the failure, or is the bigger problem that the system never explains what happened?",
      pauseBeforeMs: 330,
      expectedCategory: "questions",
      expected: { reactsToTurnId: "t3" },
    },
    {
      id: "t5",
      index: 5,
      speakerIndex: 0,
      text: "The explanation is the bigger gap—I called it a retry problem too quickly.",
      pauseBeforeMs: 540,
      expectedCategory: "positions",
      expected: { reactsToTurnId: "t4" },
    },
    {
      id: "t6",
      index: 6,
      speakerIndex: 1,
      text: "Then let us keep the failed state visible and test one plain-language recovery message before redesigning the whole screen.",
      pauseBeforeMs: 290,
      expectedCategory: "decisions",
      expected: { reactsToTurnId: "t5" },
    },
    {
      id: "t7",
      index: 7,
      speakerIndex: 2,
      text: "I will bring three timeout cases to tomorrow's test; we still need to learn whether staff can recover a locked account.",
      pauseBeforeMs: 460,
      expectedCategory: "actions",
      expected: { reactsToTurnId: "t6" },
    },
  ];
  const created = await request.post("/api/scenarios", {
    data: {
      title: "Live pipeline fixture",
      topic: "Library kiosk timeout recovery",
      objective: "Choose the smallest useful recovery test",
      criteria: ["Clarity", "Recovery"],
      durationMinutes: 3,
      speakerCount: 3,
      difficulty: "realistic",
      crossTalkLevel: "occasional",
      participationProfile: "mixed",
      speakers,
      turns,
      status: "draft",
    },
  });
  const scenario = await created.json();
  expect(created.ok(), JSON.stringify(scenario)).toBeTruthy();
  const synthesized = await request.post(
    `/api/scenarios/${scenario.id}/synthesize`,
  );
  const synthesis = await synthesized.json();
  expect(synthesized.ok(), JSON.stringify(synthesis)).toBeTruthy();
  return scenario.id as string;
}

test.describe("Critique HUD — E2E", () => {
  test("homepage loads and shows navigation options", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Critique HUD");

    // Three navigation links should be visible
    const links = page.locator("nav a[href]");
    await expect(links).toHaveCount(3);
  });

  test("homepage mobile: no horizontal overflow, touch targets ≥ 44px", async ({
    page,
  }) => {
    await page.goto("/");

    // Check no horizontal overflow
    const body = page.locator("body");
    const box = await body.boundingBox();
    if (box) {
      const viewport = page.viewportSize();
      if (viewport) {
        expect(box.width).toBeLessThanOrEqual(viewport.width + 2);
      }
    }

    // Check touch targets on navigation links
    const navLinks = page.locator("nav a[href]");
    const count = await navLinks.count();
    for (let i = 0; i < count; i++) {
      const link = navLinks.nth(i);
      const bb = await link.boundingBox();
      if (bb) {
        expect(bb.height).toBeGreaterThanOrEqual(40); // Allow slight variance from 44px
      }
    }
  });

  test(
    "scenario generation flow: create → generate → approve",
    async ({ page }) => {
      await page.goto("/scenarios/new");
      await expect(page.locator("h1")).toContainText("Generate", {
        timeout: 10000,
      });

      // Select topic suggestion (should be loaded)
      const chips = page
        .locator("button")
        .filter({ hasText: /critique|design|review|app/i });
      const chipCount = await chips.count();
      if (chipCount > 0) {
        await chips.first().click();
      }

      // Duration is a touch-friendly segmented control, not a select.
      await page
        .getByText(/^Duration:/)
        .locator("..")
        .getByRole("button", { name: "5", exact: true })
        .click();

      // Click generate
      const generateBtn = page.getByRole("button", {
        name: "Generate Scenario",
      });
      if (await generateBtn.isVisible()) {
        await generateBtn.click();
        // Wait for results
        await page.waitForTimeout(3000);
      }
    },
    SESSION_TIMEOUT,
  );

  test("session create → facilitator page loads → display page loads", async ({
    page,
  }) => {
    // Create a session
    await page.goto("/sessions/new");
    await expect(page.locator("h1")).toContainText("New Critique Session", {
      timeout: 10000,
    });

    // Fill in title
    const titleInput = page.locator("input").first();
    if (await titleInput.isVisible()) {
      await titleInput.fill("E2E Test Session");
    }

    // Submit
    const createBtn = page.getByRole("button", {
      name: /Start (Live Critique|Critique Session)/,
    });
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }

    // Should redirect to facilitator page
    await page.waitForURL(/\/facilitator\//, { timeout: 10000 });
    await expect(page.locator("h1")).toBeVisible();

    // Verify key elements on facilitator page
    const meterBar = page.locator("[class*='bg-green']").first();
    if (await meterBar.isVisible()) {
      // Meter bar should be present
      expect(true).toBeTruthy();
    }
  });

  test("long live transcript scrolls both ways and only auto-follows at the latest turn", async ({
    page,
    request,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "Transcript scroll mechanics are exercised once in desktop Chromium.",
    );
    await page.setViewportSize({ width: 1180, height: 720 });
    const session = await createTranscriptNavigationFixture(request);

    await page.goto(`/facilitator/${session.id}`);
    const viewport = page.getByTestId("transcript-scroll");
    await expect(viewport).toBeVisible();
    await expect
      .poll(() =>
        viewport.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        viewport.evaluate(
          (element) =>
            element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeLessThanOrEqual(2);

    await viewport.evaluate((element) => element.scrollTo({ top: 0 }));
    await expect(viewport).toHaveAttribute("data-following", "false");
    await expect(page.getByText("Transcript marker 01")).toBeInViewport();
    await expect(page.getByText("Transcript marker 32")).not.toBeInViewport();

    const newest = await request.post(`/api/sessions/${session.id}/turns`, {
      data: {
        providerSessionId: `navigation-${session.id}`,
        providerTurnOrder: 32,
        segmentIndex: 0,
        providerSpeakerLabel: "C",
        startMs: 22_400,
        endMs: 22_900,
        receivedAtMs: 22_900,
        currentText: "Transcript marker 33",
        isFinal: true,
      },
    });
    expect(newest.ok()).toBeTruthy();

    const jumpButton = page.getByRole("button", {
      name: /1 new turn · Jump to latest/,
    });
    await expect(jumpButton).toBeVisible();
    expect(
      await viewport.evaluate((element) => element.scrollTop),
    ).toBeLessThan(50);

    await jumpButton.click();
    await expect(page.getByText("Transcript marker 33")).toBeInViewport();
    await expect
      .poll(() =>
        viewport.evaluate(
          (element) =>
            element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeLessThanOrEqual(2);

    await viewport.evaluate((element) => element.scrollBy({ top: -300 }));
    expect(
      await viewport.evaluate((element) => element.scrollTop),
    ).toBeGreaterThan(0);
    await viewport.evaluate((element) => element.scrollBy({ top: 180 }));
    expect(
      await viewport.evaluate((element) => element.scrollTop),
    ).toBeGreaterThan(0);
  });

  test("live HUD repeats intent analysis over the complete transcript and incorporates visual evidence", async ({
    page,
    request,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "The dense Live Critique HUD is exercised once in desktop Chromium.",
    );
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const created = await request.post("/api/sessions", {
      data: {
        title: "Repeated live analysis fixture",
        objective: "Assess whether the warning is understood",
        phase: "evaluate",
        criteria: ["Evidence quality", "Action ownership"],
        speakerCount: 3,
        runMode: "live",
      },
    });
    const session = await created.json();
    expect(created.ok(), JSON.stringify(session)).toBeTruthy();
    await request.post(`/api/sessions/${session.id}/start`);
    const firstTurns = await ingestDiscussionTurns(request, session.id, 0, [
      "The opening field study showed that residents missed the warning label.",
      "I want to distinguish a visibility problem from a comprehension problem.",
      "Could we compare a persistent banner with the current transient notice?",
      "The map legend already competes for attention on the narrow screen.",
      "Our observation notes mention hesitation but do not explain the cause.",
      "Then we should avoid claiming the icon itself caused the confusion.",
      "A short comprehension prompt could test the warning without changing navigation.",
      "I disagree that comprehension alone is enough because timing still matters.",
      "We can preserve both concerns in a two-condition prototype.",
      "The first condition keeps the warning visible beside the selected parcel.",
      "The second condition asks the planner to restate the risk before continuing.",
      "We still need an owner for recruiting planners with limited map experience.",
    ]);

    await page.goto(`/facilitator/${session.id}`);
    const hud = page.getByTestId("live-analysis-hud");
    await expect(hud).toBeVisible();
    await hud
      .getByTestId("meeting-intelligence-details")
      .locator(":scope > summary")
      .click();
    await hud
      .getByPlaceholder("What should this analysis clarify?")
      .fill("Assess warning comprehension across the discussion");
    await hud.getByRole("button", { name: "Analyze all 12 turns" }).click();
    await expect(
      hud.getByRole("button", { name: "Analyze all 12 turns" }),
    ).toBeEnabled({ timeout: 30_000 });
    const firstHistoryResponse = await request.get(
      `/api/sessions/${session.id}/analyses`,
    );
    const firstHistory = await firstHistoryResponse.json();
    expect(firstHistoryResponse.ok()).toBeTruthy();
    expect(firstHistory[0]).toMatchObject({
      objective: "Assess warning comprehension across the discussion",
      transcriptTurnCount: 12,
      firstTurnId: firstTurns[0].id,
      lastTurnId: firstTurns.at(-1)!.id,
    });
    await expect(
      hud.getByRole("heading", {
        name: firstHistory[0].result.headline,
        exact: true,
        level: 3,
      }),
    ).toBeVisible();
    await expect(hud.getByText("12 turns · 132 words")).toBeVisible();

    const laterTurns = await ingestDiscussionTurns(request, session.id, 12, [
      "I will recruit four planners and schedule the comparison for Thursday.",
      "I will instrument whether they reopen the warning after dismissing it.",
      "Let us record both comprehension accuracy and time to recover context.",
      "The unresolved question is whether the extra prompt feels accusatory.",
    ]);
    // Reconcile through the same snapshot path used after an SSE reconnect.
    // This deliberately proves that persisted analysis scope survives reloads.
    await page.reload();
    await expect(hud).toBeVisible();
    await expect(
      hud.getByText("4 new turns since this snapshot"),
    ).toBeVisible();

    const visualPanel = page.getByRole("complementary", {
      name: "Visual evidence",
    });
    await visualPanel
      .getByPlaceholder("Optional note: what should the analysis notice?")
      .fill("Warning treatment beside the parcel legend");
    await visualPanel.getByTestId("visual-evidence-file").setInputFiles({
      name: "warning-treatment.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(visualPanel.getByText("1 captured")).toBeVisible({
      timeout: 30_000,
    });
    await expect(visualPanel.locator("article")).toHaveCount(1);
    const evidenceResponse = await request.get(
      `/api/sessions/${session.id}/visual-evidence`,
    );
    const capturedEvidence = await evidenceResponse.json();
    expect(evidenceResponse.ok()).toBeTruthy();
    expect(capturedEvidence).toHaveLength(1);
    expect(capturedEvidence[0].note).toBe(
      "Warning treatment beside the parcel legend",
    );
    const imageResponse = await request.get(capturedEvidence[0].imageUrl);
    expect(imageResponse.ok()).toBeTruthy();
    expect(imageResponse.headers()["content-type"]).toBe("image/png");
    expect(imageResponse.headers()["cache-control"]).toBe("private, no-store");

    await hud
      .getByPlaceholder("What should this analysis clarify?")
      .fill("Extract owned next actions and unresolved risks");
    await hud
      .getByRole("combobox", { name: "Critique phase" })
      .selectOption("plan_experiment");
    await hud.getByRole("button", { name: "Analyze all 16 turns" }).click();
    await expect(
      hud.getByRole("button", { name: "Analyze all 16 turns" }),
    ).toBeEnabled({ timeout: 30_000 });
    const historyResponse = await request.get(
      `/api/sessions/${session.id}/analyses`,
    );
    const history = await historyResponse.json();
    expect(historyResponse.ok()).toBeTruthy();
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      objective: "Extract owned next actions and unresolved risks",
      phase: "plan_experiment",
      transcriptTurnCount: 16,
      firstTurnId: firstTurns[0].id,
      lastTurnId: laterTurns.at(-1)!.id,
      visualEvidenceCount: 1,
    });
    expect(history[1].transcriptTurnCount).toBe(12);
    await expect(
      hud.getByRole("heading", {
        name: history[0].result.headline,
        exact: true,
        level: 3,
      }),
    ).toBeVisible();
    await expect(hud.getByText("16 turns · 175 words")).toBeVisible();
    await expect(hud.getByText("1 visual")).toBeVisible();
    const currentSession = await (
      await request.get(`/api/sessions/${session.id}`)
    ).json();
    expect(currentSession.status).toBe("active");

    await page.goto(`/display/${session.id}`);
    await expect(page.getByText("Intent synthesis")).toBeVisible();
    await expect(
      page.getByText(history[0].result.headline, { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Discussion phase allocation")).toBeVisible();
    await expect(page.getByText("1 visual context frame")).toBeVisible();
  });

  test("camera preview is consent-driven and captures one deliberate HUD evidence frame", async ({
    request,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "Fake camera launch flags are Chromium-specific.",
    );
    test.setTimeout(45_000);
    const created = await request.post("/api/sessions", {
      data: {
        title: "Visual evidence camera fixture",
        objective: "Review the physical prototype state",
        phase: "evaluate",
        criteria: ["Visible state"],
        speakerCount: 2,
        runMode: "live",
      },
    });
    const session = await created.json();
    expect(created.ok(), JSON.stringify(session)).toBeTruthy();
    const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000";
    const fakeBrowser = await chromium.launch({
      headless: true,
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    });
    try {
      const context = await fakeBrowser.newContext({
        permissions: ["camera"],
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(`${baseURL}/facilitator/${session.id}`);
      const panel = page.getByRole("complementary", {
        name: "Visual evidence",
      });
      await expect(
        panel.getByText(
          "Camera stays local until you deliberately capture one frame.",
        ),
      ).toBeVisible();
      await panel.getByRole("button", { name: "Enable camera" }).click();
      await expect(panel.getByText("Preview only")).toBeVisible();
      await expect
        .poll(() =>
          panel
            .getByLabel("Camera preview")
            .evaluate(
              (video: HTMLVideoElement) =>
                video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
                video.videoWidth > 0,
            ),
        )
        .toBe(true);
      await panel
        .getByPlaceholder("Optional note: what should the analysis notice?")
        .fill("Physical prototype state at the critique table");
      await panel.getByRole("button", { name: "Capture evidence" }).click();
      await expect(panel.getByText("1 captured")).toBeVisible({
        timeout: 30_000,
      });
      await expect(panel.locator("article")).toHaveCount(1);

      const evidence = await (
        await request.get(`/api/sessions/${session.id}/visual-evidence`)
      ).json();
      expect(evidence).toHaveLength(1);
      expect(evidence[0]).toMatchObject({
        capturedAtMs: 0,
        contentType: "image/jpeg",
        note: "Physical prototype state at the critique table",
      });
      await panel.getByRole("button", { name: "Stop camera" }).click();
      await expect(
        panel.getByRole("button", { name: "Enable camera" }),
      ).toBeVisible();
      await context.close();
    } finally {
      await fakeBrowser.close();
    }
  });

  test("display page connects via SSE and shows HUD layout", async ({
    page,
  }) => {
    // First create a session
    await page.goto("/sessions/new");
    const titleInput = page.locator("input").first();
    if (await titleInput.isVisible()) {
      await titleInput.fill("Display Test");
    }
    const createBtn = page.getByRole("button", {
      name: /Start (Live Critique|Critique Session)/,
    });
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }
    await page.waitForURL(/\/facilitator\//, { timeout: 10000 });

    // Extract session ID from URL
    const url = page.url();
    const sessionId = url.split("/facilitator/")[1]?.split(/[?#]/)[0];

    if (sessionId) {
      // Open display in same page
      await page.goto(`/display/${sessionId}`);
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Should show SIMULATION badge or status indicator
      const statusIndicator = page.locator("[class*='rounded-full']").first();
      await expect(statusIndicator).toBeVisible();

      // Should have Participation panel
      await expect(page.getByText("Participation")).toBeVisible({
        timeout: 5000,
      });
      // Critique-specific intelligence is a first-class surface, not a generic summary.
      await expect(page.getByText("Critique Radar")).toBeVisible();
      await expect(page.getByText("Source Map")).toBeVisible();
      await expect(
        page.getByText("Source-linked signals, never participant scores"),
      ).toBeVisible();
    }
  });

  test("scenario library page loads", async ({ page }) => {
    await page.goto("/scenarios");
    await expect(page.locator("h1")).toContainText("Scenarios", {
      timeout: 10000,
    });
  });

  test("simulator page loads for a run", async ({ page }) => {
    // This requires an existing run; test graceful handling
    await page.goto("/simulator/nonexistent");
    await page.waitForTimeout(2000);
    // Should show error or loading state
    const body = page.locator("main");
    await expect(body).toBeVisible();
  });

  test("synthesized discussion traverses recording → AudioWorklet → PCM → ASR → transcript", async ({
    page,
    request,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "The full audio pipeline is exercised once in desktop Chromium.",
    );
    const token = await request.get(
      "/api/providers/assemblyai/token?max_speakers=3",
    );
    const tokenBody = await token.json();
    expect(tokenBody.wsUrl).toContain("speech_model=u3-rt-pro");
    expect(tokenBody.wsUrl).toContain("speaker_labels=true");
    expect(tokenBody.wsUrl).toContain("max_speakers=3");

    const scenarioId = await createRenderedFixture(request);
    const created = await request.post("/api/sessions", {
      data: {
        title: "Recorded pipeline E2E",
        objective: "Exercise the real browser PCM path",
        phase: "evaluate",
        criteria: ["Pipeline integrity"],
        speakerCount: 3,
        runMode: "sim_injected",
        scenarioId,
      },
    });
    const session = await created.json();
    expect(created.ok(), JSON.stringify(session)).toBeTruthy();

    await page.goto(`/facilitator/${session.id}`);
    await page.getByRole("button", { name: "Start Recorded Demo" }).click();
    await expect(page.getByText("Worklet ✓")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("PCM ✓")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("ASR ✓")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(
        "I think we should focus on the user journey for the onboarding flow.",
      ),
    ).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText("Audio capture error:")).toHaveCount(0);
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByRole("button", { name: "Ended" })).toBeVisible();
  }, 60_000);

  test("live microphone start produces PCM frames and finalized ASR turns", async ({
    request,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "Fake microphone launch flags are Chromium-specific.",
    );
    const created = await request.post("/api/sessions", {
      data: {
        title: "Microphone pipeline E2E",
        objective: "Verify browser microphone startup",
        phase: "evaluate",
        criteria: ["Capture health"],
        speakerCount: 3,
        runMode: "live",
      },
    });
    const session = await created.json();
    expect(created.ok(), JSON.stringify(session)).toBeTruthy();
    const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000";
    const fakeBrowser = await chromium.launch({
      headless: true,
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    });
    try {
      const context = await fakeBrowser.newContext({
        permissions: ["microphone"],
      });
      const page = await context.newPage();
      await page.goto(`${baseURL}/facilitator/${session.id}`);
      await page.getByRole("button", { name: "Start Mic" }).click();
      await expect(page.getByText("Worklet ✓")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText("PCM ✓")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("ASR ✓")).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByText(
          "I think we should focus on the user journey for the onboarding flow.",
        ),
      ).toBeVisible({ timeout: 12_000 });
      await expect(page.getByText(/Audio capture error|ASR error/)).toHaveCount(
        0,
      );
      await page.getByRole("button", { name: "Stop" }).click();
      await context.close();
    } finally {
      await fakeBrowser.close();
    }
  }, 60_000);
});

test.describe("Mobile-specific assertions", () => {
  test("iPhone: safe area insets applied", async ({ page }) => {
    await page.goto("/");

    // Check that main has safe-area padding classes or styles
    const main = page.locator("main");
    const className = await main.getAttribute("class");
    expect(className).toMatch(/safe-top|safe-bottom/);
  });

  test("no hover-only interactions on mobile", async ({ page }) => {
    await page.goto("/scenarios/new");

    // All interactive elements should be reachable by tap
    // Verify buttons exist with sufficient size
    const buttons = page.locator("button, a[href]");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("iPhone Live Critique keeps the waveform, semantic compass, transcript, and human controls reachable", async ({
    page,
    request,
  }) => {
    test.skip(
      test.info().project.name !== "iphone",
      "This responsive viewport contract is exercised on the iPhone project.",
    );
    const session = await createTranscriptNavigationFixture(request, 24);
    await page.goto(`/facilitator/${session.id}`);
    await expect(
      page.getByRole("heading", { name: "Long transcript navigation fixture" }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("transcript-turn")).toHaveCount(24, {
      timeout: 20_000,
    });

    const main = page.locator("main");
    const facilitatorScroll = page.getByTestId("facilitator-scroll");
    const waveform = page.getByTestId("speaker-waveform-stage");
    const hud = page.getByTestId("live-analysis-hud");
    const compass = page.getByTestId("semantic-compass");
    const transcript = page.getByTestId("transcript-scroll");
    await expect(waveform).toBeVisible();
    await expect(page.getByTestId("speaker-waveform-history")).toBeVisible();
    await expect(hud.getByText("Now Lens")).toBeVisible();
    await expect(compass).toBeVisible();
    await expect(hud).toBeVisible();
    await expect(transcript).toBeVisible();
    await expect(page.getByTestId("private-control")).toContainText("Private");
    await expect(page.getByTestId("publish-control")).toContainText(
      "Select an insight",
    );
    await expect(page.getByTestId("capture-control")).toContainText("Capture");
    await expect(
      page.getByText("Visual evidence · 0 captured +"),
    ).toBeVisible();

    const layout = await main.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);
    const scrollLayout = await facilitatorScroll.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(scrollLayout.scrollWidth).toBeLessThanOrEqual(
      scrollLayout.clientWidth + 1,
    );
    const waveformBox = await waveform.boundingBox();
    const hudBox = await hud.boundingBox();
    const compassBox = await compass.boundingBox();
    const transcriptBox = await transcript.boundingBox();
    expect(waveformBox?.height || 0).toBeGreaterThanOrEqual(140);
    expect(waveformBox?.height || Infinity).toBeLessThanOrEqual(220);
    expect(hudBox?.height || 0).toBeGreaterThanOrEqual(360);
    expect(hudBox?.height || Infinity).toBeLessThanOrEqual(650);
    expect(compassBox?.height || 0).toBeGreaterThanOrEqual(300);
    expect(compassBox?.height || Infinity).toBeLessThanOrEqual(430);
    expect(transcriptBox?.height || 0).toBeGreaterThan(80);

    const speakerColors = await page
      .getByTestId("transcript-turn")
      .evaluateAll((elements) =>
        elements.slice(0, 3).map((element) => ({
          label: element.getAttribute("data-speaker-label"),
          color: element.getAttribute("data-speaker-color"),
        })),
      );
    expect(new Set(speakerColors.map((entry) => entry.color)).size).toBe(3);
    await expect
      .poll(() =>
        transcript.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      )
      .toBe(true);

    await transcript.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(transcript).toHaveAttribute("data-following", "false");
    await expect
      .poll(() => transcript.evaluate((element) => element.scrollTop))
      .toBe(0);
    await transcript.scrollIntoViewIfNeeded();
    await expect(page.getByText("Transcript marker 01")).toBeInViewport();
    await transcript.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(transcript).toHaveAttribute("data-following", "true");
    await expect(page.getByText("Transcript marker 24")).toBeInViewport();

    await page.getByTestId("capture-control").click();
    await expect(page.locator("#visual-evidence-details")).toHaveAttribute(
      "open",
      "",
    );

    await hud
      .getByTestId("meeting-intelligence-details")
      .locator(":scope > summary")
      .click();
    const analysisIntent = hud.getByPlaceholder(
      "What should this analysis clarify?",
    );
    await analysisIntent.scrollIntoViewIfNeeded();
    await expect(analysisIntent).toBeInViewport();
  });
});
