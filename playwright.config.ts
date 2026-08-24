import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

function getPlaywrightCacheDir(): string {
  return process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), '.cache/ms-playwright');
}

function hasPlaywrightChromium(): boolean {
  const cacheDir = getPlaywrightCacheDir();
  if (!existsSync(cacheDir)) {
    return false;
  }

  return readdirSync(cacheDir)
    .filter((entry) => entry.startsWith('chromium'))
    .some((entry) => {
      const candidates = [
        join(cacheDir, entry, 'chrome-linux', 'chrome'),
        join(cacheDir, entry, 'chrome-linux64', 'chrome'),
        join(
          cacheDir,
          entry,
          'chrome-headless-shell-linux64',
          'chrome-headless-shell',
        ),
      ];

      return candidates.some((path) => existsSync(path));
    });
}

function resolveChromiumExecutable(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }

  if (hasPlaywrightChromium()) {
    return undefined;
  }

  for (const path of [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ]) {
    if (existsSync(path)) {
      return path;
    }
  }

  return undefined;
}

const chromiumExecutable = resolveChromiumExecutable();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    ...(chromiumExecutable
      ? { launchOptions: { executablePath: chromiumExecutable } }
      : {}),
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
