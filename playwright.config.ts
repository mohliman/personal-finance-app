import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5198',
    viewport: { width: 1440, height: 1024 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined),
      args: ['--disable-gpu', '--renderer-process-limit=2'],
    },
    screenshot: 'only-on-failure',
  },
  webServer: { command: 'npm run preview -- --port 5198 --strictPort', url: 'http://127.0.0.1:5198', reuseExistingServer: true },
});
