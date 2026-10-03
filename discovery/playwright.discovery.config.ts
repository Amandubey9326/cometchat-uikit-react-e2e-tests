import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';

/**
 * Phase-0 discovery config: starts the sample app in "upstream mode"
 * (credentials screen, SDK default production hosts) on its own port and runs
 * the read-only crawler that records every screen's accessibility tree.
 */
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const APP_DIR = process.env.APP_DIR ?? path.join(os.homedir(), 'uikit-react', 'sample-app');
const PORT = Number(process.env.APP_PORT ?? 3105);

export default defineConfig({
  testDir: '.',
  testMatch: 'discover.spec.ts',
  outputDir: '../test-results/discovery',
  timeout: 5 * 60_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    baseURL: `http://localhost:${PORT}`,
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    cwd: APP_DIR,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
    // Empty overrides = upstream sample-app behaviour (no hard-coded app / hosts).
    env: {
      VITE_COMETCHAT_APP_ID: '',
      VITE_COMETCHAT_REGION: '',
      VITE_COMETCHAT_AUTH_KEY: '',
      VITE_COMETCHAT_CLIENT_HOST: '',
      VITE_COMETCHAT_ADMIN_HOST: '',
    },
  },
});
