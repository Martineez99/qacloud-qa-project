import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default defineConfig({
  testDir: '../src',
  timeout: Number(process.env.TEST_TIMEOUT) || 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    [
      'allure-playwright',
      {
        detail: true,
        resultsDir: path.resolve(__dirname, '../reports/allure-results'), // ← era outputFolder
        suiteTitle: false,
        environmentInfo: {
          App_Version: '1.0.0',
          Platform: process.platform,
          Node_Version: process.version,
          Base_URL: process.env.QACLOUD_BASE_URL || 'https://www.qacloud.dev',
        },
      },
    ],
  ],

  use: {
    baseURL: process.env.QACLOUD_BASE_URL || 'https://www.qacloud.dev',
    headless: process.env.HEADLESS !== 'false',
    slowMo: Number(process.env.SLOW_MO) || 0,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    // ── Setups ────────────────────────────────────────────────────────────────
    {
      name: 'setup-platform',
      testMatch: '**/fixtures/platform.setup.ts',
    },
    {
      name: 'setup-market',
      testMatch: '**/fixtures/auth.setup.ts',
    },

    // ── Smoke login: SIN sesión — prueban el formulario de login ──────────────
    {
      name: 'smoke-login',
      testMatch: '**/e2e/smoke/login.spec.ts',
      // Sin storageState ni dependencies — arranca sin sesión
    },

    // ── Smoke navigation: sesión de plataforma ────────────────────────────────
    {
      name: 'smoke-navigation',
      testMatch: '**/e2e/smoke/navigation.spec.ts',
      dependencies: ['setup-platform'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/platform.json',
      },
    },

    // ── Market E2E: sesión de Market app ──────────────────────────────────────
    {
      name: 'e2e-market',
      testMatch: '**/e2e/market/**/*.spec.ts',
      dependencies: ['setup-market'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/market.json',
      },
    },

    {
      name: 'api-market',
      testMatch: '**/api/market/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  
});
