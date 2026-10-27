import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const fixturePath =
  process.env.BROWSER_FIXTURE_PATH ||
  path.resolve('evidence/forum-f2-messaging-browser/fixture.json');

let baseURL = process.env.BROWSER_BASE_URL || 'http://127.0.0.1:8780';
if (fs.existsSync(fixturePath)) {
  try {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    if (fixture.baseUrl) baseURL = fixture.baseUrl;
  } catch {
    // Fixture may not exist yet during config load; tests fail clearly later.
  }
}

export default defineConfig({
  testDir: 'tests/browser',
  testMatch: '**/*.spec.mjs',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'evidence/forum-f2-messaging-browser/playwright-report.json' }],
  ],
  use: {
    baseURL,
    headless: true,
    launchOptions: {
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Prefer Playwright-managed Chromium; fall back to system Chrome/Chromium
        // when PLAYWRIGHT_CHROME_CHANNEL is set (local hosts with flaky CDN downloads).
        ...(process.env.PLAYWRIGHT_CHROME_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHROME_CHANNEL }
          : {}),
        ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
          : {}),
      },
    },
  ],
});
