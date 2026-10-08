import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5186',
    headless: true,
    screenshot: 'only-on-failure',
    launchOptions: {
      channel: process.env.CI ? undefined : 'msedge',
      args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: [
    {
      command: 'npm run dev -- --port 5186 --strictPort',
      url: 'http://127.0.0.1:5186',
      reuseExistingServer: true,
    },
    {
      command: 'npm run ranking:dev',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: true,
    },
  ],
});
