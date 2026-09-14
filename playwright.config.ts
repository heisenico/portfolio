import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4321/portfolio/' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321/portfolio/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
