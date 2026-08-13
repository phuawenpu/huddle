import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.BASE_URL;
const sessionCookie = process.env.PLAYWRIGHT_SESSION_COOKIE;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 1,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "e2e-results.json" }]],

  use: {
    baseURL: externalBaseURL || "http://localhost:3000",
    storageState: sessionCookie
      ? {
          cookies: [
            {
              name: "huddle_session",
              value: sessionCookie,
              domain: new URL(externalBaseURL || "http://localhost:3000")
                .hostname,
              path: "/",
              httpOnly: true,
              secure: externalBaseURL?.startsWith("https://") || false,
              sameSite: "Strict",
              expires: -1,
            },
          ],
          origins: [],
        }
      : undefined,
    extraHTTPHeaders: externalBaseURL ? { Origin: externalBaseURL } : undefined,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "iphone", use: { ...devices["iPhone 14"] } },
    { name: "android-phone", use: { ...devices["Pixel 5"] } },
    { name: "ipad", use: { ...devices["iPad (gen 7)"] } },
  ],

  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run dev",
        env: {
          AUTH_DISABLED: "1",
          ASR_STUB: "1",
          LLM_STUB: "1",
          TTS_STUB: "1",
          DATABASE_URL: "file:/tmp/huddle-playwright.db",
        },
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      },
});
