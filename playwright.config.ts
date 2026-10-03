import { defineConfig, devices } from '@playwright/test';
import './config/run'; // fixes PW_RUN_ID before workers start
import path from 'node:path';
import { ROOT_DIR, env } from './config/env';

const CI = !!process.env.CI;
const BUILD_DIR = path.join(ROOT_DIR, '.app-build', env.locale);
const DESKTOP = { width: 1440, height: 900 };

/** Chromium flags so calls and voice notes get a fake camera / microphone. */
const FAKE_MEDIA = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];

const needsAuth = { testDir: './tests' };

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: Number(process.env.PW_WORKERS ?? (CI ? 2 : 4)),
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    // Read by scripts/coverage_matrix.py (npm run coverage:matrix).
    ['json', { outputFile: 'reports/results.json' }],
  ],
  globalSetup: './setup/global-setup.ts',
  globalTeardown: './setup/global-teardown.ts',

  use: {
    baseURL: env.baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // ── setup / maintenance ────────────────────────────────────────────────
    // Only on request (`npm run cleanup`): it deletes ALL pw-* data, so it must never run
    // alongside a normal run's persona setup.
    ...(process.env.PW_CLEANUP === '1' ? [{ name: 'cleanup', testDir: './setup', testMatch: 'cleanup.setup.ts' }] : []),

    // ── functional ─────────────────────────────────────────────────────────
    {
      name: 'chromium',
      ...needsAuth,
      use: { ...devices['Desktop Chrome'], viewport: DESKTOP },
      grepInvert: /@calls|@responsive/,
    },
    // PW_NO_FIREFOX=1 drops Firefox where it cannot launch locally (ENV-001: macOS 27); CI runs it.
    ...(process.env.PW_NO_FIREFOX === '1'
      ? []
      : [
          {
            name: 'firefox',
            ...needsAuth,
            use: { ...devices['Desktop Firefox'], viewport: DESKTOP },
            grep: /@smoke|@critical/,
            grepInvert: /@calls|@responsive/,
          },
        ]),
    {
      name: 'webkit',
      ...needsAuth,
      use: { ...devices['Desktop Safari'], viewport: DESKTOP },
      grep: /@smoke|@critical/,
      grepInvert: /@calls|@responsive/,
    },
    {
      name: 'calls',
      ...needsAuth,
      use: {
        ...devices['Desktop Chrome'],
        viewport: DESKTOP,
        permissions: ['camera', 'microphone'],
        launchOptions: { args: FAKE_MEDIA },
      },
      grep: /@calls/,
    },
    { name: 'tablet', ...needsAuth, use: { ...devices['iPad (gen 7) landscape'] }, grep: /@responsive/ },
    { name: 'mobile', ...needsAuth, use: { ...devices['Pixel 7'] }, grep: /@responsive/ },
  ],

  // Serves the sample app in upstream mode (credentials screen) against the chosen environment.
  // Default: a production build + `vite preview` (no dev-server reloads mid-run, closest to
  // what users run; the build takes ~3 s). APP_MODE=dev uses the Vite dev server instead.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command:
          process.env.APP_MODE === 'dev'
            ? `npm run dev -- --port ${env.appPort} --strictPort`
            : `npx vite build --outDir "${BUILD_DIR}" --emptyOutDir --logLevel error && ` +
              `npx vite preview --outDir "${BUILD_DIR}" --port ${env.appPort} --strictPort`,
        cwd: env.appDir,
        url: env.baseURL,
        reuseExistingServer: !CI,
        timeout: 180_000,
        env: {
          VITE_COMETCHAT_APP_ID: '',
          VITE_COMETCHAT_REGION: '',
          VITE_COMETCHAT_AUTH_KEY: '',
          VITE_COMETCHAT_CLIENT_HOST: env.appHosts.client,
          VITE_COMETCHAT_ADMIN_HOST: env.appHosts.admin,
          // PW_LOCALE=fr runs the whole suite against a French build (sample-app hook in src/index.tsx).
          VITE_COMETCHAT_LOCALE: env.locale === 'en-us' ? '' : env.locale,
        },
      },
});
