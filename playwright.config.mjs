import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/Portifolio/',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://127.0.0.1:4173/Portifolio/',
    reuseExistingServer: !process.env.CI,
    timeout: 20000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
