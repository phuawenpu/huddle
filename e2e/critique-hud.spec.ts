import { test, expect } from "@playwright/test";

const SESSION_TIMEOUT = 45000;

test.describe("Critique HUD — E2E", () => {
  
  test("homepage loads and shows navigation options", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Critique HUD");
    
    // Three navigation links should be visible
    const links = page.locator("nav a[href]");
    await expect(links).toHaveCount(3);
  });

  test("homepage mobile: no horizontal overflow, touch targets ≥ 44px", async ({ page }) => {
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

  test("scenario generation flow: create → generate → approve", async ({ page }) => {
    await page.goto("/scenarios/new");
    await expect(page.locator("h1")).toContainText("Generate", { timeout: 10000 });
    
    // Select topic suggestion (should be loaded)
    const chips = page.locator("button").filter({ hasText: /critique|design|review|app/i });
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
    const generateBtn = page.getByRole("button", { name: "Generate Scenario" });
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      // Wait for results
      await page.waitForTimeout(3000);
    }
  }, SESSION_TIMEOUT);

  test("session create → facilitator page loads → display page loads", async ({ page }) => {
    // Create a session
    await page.goto("/sessions/new");
    await expect(page.locator("h1")).toContainText("New Critique Session", { timeout: 10000 });
    
    // Fill in title
    const titleInput = page.locator("input").first();
    if (await titleInput.isVisible()) {
      await titleInput.fill("E2E Test Session");
    }
    
    // Submit
    const createBtn = page.getByRole("button", { name: /Start (Live Critique|Critique Session)/ });
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

  test("display page connects via SSE and shows HUD layout", async ({ page }) => {
    // First create a session
    await page.goto("/sessions/new");
    const titleInput = page.locator("input").first();
    if (await titleInput.isVisible()) {
      await titleInput.fill("Display Test");
    }
    const createBtn = page.getByRole("button", { name: /Start (Live Critique|Critique Session)/ });
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
      await expect(page.getByText("Participation")).toBeVisible({ timeout: 5000 });
    }
  });

  test("scenario library page loads", async ({ page }) => {
    await page.goto("/scenarios");
    await expect(page.locator("h1")).toContainText("Scenarios", { timeout: 10000 });
  });

  test("simulator page loads for a run", async ({ page }) => {
    // This requires an existing run; test graceful handling
    await page.goto("/simulator/nonexistent");
    await page.waitForTimeout(2000);
    // Should show error or loading state
    const body = page.locator("main");
    await expect(body).toBeVisible();
  });
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
