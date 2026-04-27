import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default defineConfig({
  testDir: '../src/api',
  timeout: 15000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['list'],
    [
      'allure-playwright',
      {
        detail: true,
        outputFolder: 'reports/allure-results',
      },
    ],
  ],

  use: {
    baseURL: process.env.QACLOUD_BASE_URL || 'https://www.qacloud.dev',
    extraHTTPHeaders: {
      Authorization: process.env.QACLOUD_API_KEY || '',
      'Content-Type': 'application/json',
    },
  },
});
