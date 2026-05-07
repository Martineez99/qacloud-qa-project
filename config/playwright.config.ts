import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─── Shared API headers ───────────────────────────────────────────────────────
// Centralizado aquí para que todos los proyectos de API los hereden.
// Los tests E2E no los necesitan (usan storageState / UI login).
const apiHeaders = {
  Authorization: process.env.QACLOUD_API_KEY || '',
  'Content-Type': 'application/json',
};

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
        resultsDir: path.resolve(__dirname, '../reports/allure-results'),
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

  // ─── Defaults para E2E (browser) ────────────────────────────────────────────
  // Los proyectos de API sobreescriben lo que no necesitan.
  use: {
    baseURL: process.env.QACLOUD_BASE_URL || 'https://www.qacloud.dev',
    headless: process.env.HEADLESS !== 'false',
    slowMo: Number(process.env.SLOW_MO) || 0,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [

    // ── Setups ─────────────────────────────────────────────────────────────────
    {
      name: 'setup-platform',
      testMatch: '**/fixtures/platform.setup.ts',
    },
    {
      name: 'setup-market',
      testMatch: '**/fixtures/auth.setup.ts',
    },

    // ── Smoke login: SIN sesión — prueba el formulario de login ───────────────
    {
      name: 'smoke-login',
      testMatch: '**/e2e/smoke/login.spec.ts',
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

    // ── API Market ─────────────────────────────────────────────────────────────
    // Sin browser — sobreescribe lo que no aplica a requests HTTP puros.
    {
      name: 'api-market',
      testMatch: '**/api/market/**/*.spec.ts',
      timeout: 15000, // Las llamadas API son más rápidas que los flujos E2E
      use: {
        extraHTTPHeaders: apiHeaders,
        // No necesitan browser artifacts
        screenshot: 'off',
        video: 'off',
        trace: 'off',
      },
    },

    // ── API Market — Contract tests ────────────────────────────────────────────
    {
      name: 'api-market-contract',
      testMatch: '**/api/contracts/**/*.spec.ts',
      timeout: 15000,
      use: {
        extraHTTPHeaders: apiHeaders,
        screenshot: 'off',
        video: 'off',
        trace: 'off',
      },
    },

  ],
});