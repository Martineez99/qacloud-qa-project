# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sandbox\smoke.spec.ts >> @smoke — Platform connectivity >> Hotel app loads correctly
- Location: src\e2e\sandbox\smoke.spec.ts:15:7

# Error details

```
Error: expect(page).toHaveTitle(expected) failed

Expected pattern: /Hotel|QA Cloud/i
Received string:  "Error"
Timeout: 5000ms

Call log:
  - Expect "toHaveTitle" with timeout 5000ms
    9 × unexpected value "Error"

```

# Page snapshot

```yaml
- generic [ref=e2]: Cannot GET /hotel
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('@smoke — Platform connectivity', () => {
  4  | 
  5  |   test('qacloud.dev is reachable', async ({ page }) => {
  6  |     const response = await page.goto('/');
  7  |     expect(response?.status()).toBe(200);
  8  |   });
  9  | 
  10 |   test('Market app loads correctly', async ({ page }) => {
  11 |     await page.goto('/market');
  12 |     await expect(page).toHaveTitle(/Market|QA Cloud/i);
  13 |   });
  14 | 
  15 |   test('Hotel app loads correctly', async ({ page }) => {
  16 |     await page.goto('/hotel');
> 17 |     await expect(page).toHaveTitle(/Hotel|QA Cloud/i);
     |                        ^ Error: expect(page).toHaveTitle(expected) failed
  18 |   });
  19 | 
  20 | });
```