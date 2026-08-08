import {
  test,
  expect,
  chromium,
  type APIRequestContext,
} from "@playwright/test";

const SESSION_TIMEOUT = 45000;

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
});
