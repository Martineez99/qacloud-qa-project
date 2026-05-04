// src/e2e/smoke/navigation.spec.ts
import { test } from '../../fixtures/base.fixture';
import { expect } from '@playwright/test';

test.describe('Smoke — Navigation', () => {
  const apps = ['market', 'hotel', 'bank', 'tasks', 'rental'] as const;

  for (const app of apps) {
    test(`${app} app loads successfully`, {
      tag: ['@smoke', '@navigation'],
    }, async ({ nav }) => {
      await nav.goToApp(app);
      await nav.expectAppLoaded(app);
    });
  }
});