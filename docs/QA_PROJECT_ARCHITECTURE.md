# QA Cloud — Project Architecture

> **Target platform:** [qacloud.dev](https://www.qacloud.dev/)
> **Stack:** Playwright · TypeScript · K6 · Allure · GitHub Actions
> **Level:** Senior QA Engineer
> **OS / Shell:** Windows · PowerShell

This document is the technical reference for the project. For a high-level overview, setup instructions, and running tests, see the [README](../README.md).

---

## Table of Contents

1. [Platform Analysis](#1-platform-analysis)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Testing Strategy](#4-testing-strategy)
5. [Git Workflow](#5-git-workflow)
6. [CI/CD — GitHub Actions](#6-cicd--github-actions)
7. [Allure Reporting](#7-allure-reporting)
8. [Environment Configuration](#8-environment-configuration)
9. [Conventions and Standards](#9-conventions-and-standards)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Platform Analysis

### 1.1 Applications Available

| App | Path | Level | Type | Key Test Areas |
|-----|------|-------|------|----------------|
| **Market** | `/market/*` | All levels | E-commerce | CRUD, basket, orders, stock, roles |
| **Hotel** | `/hotel/*` | Intermediate | Reservations | Booking lifecycle, chaos testing, reviews |
| **Bank** | `/bank/*` | Intermediate | Finance | Transfers, loans, concurrency, overdraft |
| **TaskTracker** | `/tasks/*` | All levels | RBAC | State transitions, permissions, forbidden actions |
| **Rental** | `/rental/*` | Intermediate | Car rental | Inventory conflicts, date validation, admin ops |
| **UI Sandbox** | `/sandbox/*` | All levels | Pure UI | Forms, modals, dropdowns, dynamic elements |
| **Crypto Simulator** | `/crypto.html` | Intermediate | WebSocket | Race conditions, chaos injection, float bugs |
| **SeatMatrix** | `/seatmatrix.html` | Intermediate | Ticketing | Multi-step booking, seat availability |
| **Data Integrity Hub** | `/datahub.html` | Intermediate | CSV/Excel | Data migration, import/export testing |

### 1.2 Swagger Documentation

Each application exposes a Swagger UI at `/<app>/docs`. All APIs share the same authentication model.

| API | Swagger URL | Authentication |
|-----|-------------|----------------|
| Market | `/market/docs` | `Authorization: qac_live_...` |
| Hotel | `/hotel/docs` | `Authorization: qac_live_...` |
| Bank | `/bank/docs` | `Authorization: qac_live_...` |
| TaskTracker | `/tasks/docs` | `Authorization: qac_live_...` |
| Rental | `/rental/docs` | `Authorization: qac_live_...` |
| SeatMatrix | `/ticket/docs` | `Authorization: qac_live_...` |

### 1.3 Platform Testing Utilities

| Tool | URL | QA Use |
|------|-----|--------|
| JSON Diff | `/tools/json-diff.html` | Compare API responses |
| Credit Card Generator | `/tools/credit-card-generator.html` | Payment test data |
| ID Generator | `/tools/id-generator.html` | AAMVA barcodes |
| Barcode Generator | `/tools/barcode-generator.html` | UPC-A, Code-128, QR |

### 1.4 Key Platform Features for Testing

- **Chaos Mode** — The Crypto Simulator allows injecting latency, crashes, and malformed payloads.
- **Intentional bugs** — All apps include documented bugs designed for detection practice.
- **Data isolation** — Every user gets a fully isolated environment, safe for destructive tests (delete, reset).
- **Reset endpoint** — `POST /api/reset` restores a deterministic state before each suite.
- **RBAC across multiple apps** — Differentiated roles (admin, user, member) for permission testing.
- **WebSocket testing** — Crypto Simulator with a live BTC/USD feed.
- **Documented edge cases** — Stock validation, price snapshots, concurrency, cascade deletes.

### 1.5 Project Scope

The project focuses on three core applications that cover all important testing patterns:

```
Market  →  E2E + API + Contract + Performance   (primary — full CRUD lifecycle)
Hotel   →  E2E + API + Chaos Testing            (booking lifecycle, in progress)
Bank    →  API + Performance                    (concurrency, financial edge cases, planned)
```

The **UI Sandbox** is used to build the reusable Page Object base library.

---

## 2. Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | `>= 20.x LTS` | Runtime |
| TypeScript | `^5.x` | Static typing across the entire suite |
| Playwright | `^1.44` | E2E tests + API tests |
| `@playwright/test` | `^1.44` | Test runner |
| K6 | latest | Performance testing |
| `allure-playwright` | `^3.x` | Allure integration for Playwright |
| `allure-commandline` | `^2.x` | Report generation |
| `dotenv` | `^16.x` | Environment variable management |
| `faker-js` | `^8.x` | Dynamic test data generation |

---

## 3. Project Structure

```
qacloud-qa-project/
│
├── .github/
│   └── workflows/
│       ├── ci-pr-main.yml          # PR gate — runs on every pull request
│       ├── e2e-tests.yml           # E2E pipeline with browser matrix
│       ├── api-tests.yml           # API pipeline, parallel by module
│       ├── performance-tests.yml   # K6 performance pipeline
│       └── nightly-full.yml        # Full regression + Allure publish to Pages
│
├── src/
│   ├── e2e/                        # Playwright E2E tests
│   │   ├── smoke/                  # Login + navigation smoke tests
│   │   └── market/                 # Products and basket E2E flows
│   │
│   ├── api/                        # Pure API tests
│   │   ├── market/                 # Products, basket, orders — happy path + edge cases
│   │   └── contracts/              # JSON Schema contract tests
│   │
│   ├── performance/                # K6 performance tests
│   │   ├── scenarios/              # Load scenarios per application
│   │   ├── thresholds/             # SLA configuration (p95, error rate)
│   │   └── data/                   # Test data for K6 virtual users
│   │
│   ├── pages/                      # Page Object Model
│   │   ├── common/                 # BasePage, NavigationComponent
│   │   └── market/                 # MarketPage, BasketPage, OrdersPage
│   │
│   ├── fixtures/                   # Playwright fixtures and auth setup
│   ├── utils/                      # API client, data factory, custom assertions, logger
│   └── types/                      # TypeScript interfaces for all domains
│
├── config/
│   └── playwright.config.ts        # Multi-project config (E2E + API + setups)
│
├── test-data/                      # Static test data (JSON)
├── scripts/                        # PowerShell utility scripts
├── reports/                        # Generated automatically — gitignored
├── docs/                           # Project documentation
├── .env.example                    # Environment variables template
└── package.json
```

---

## 4. Testing Strategy

### 4.1 Testing Pyramid

```
              ▲
             /|\
            / | \          E2E (Playwright)
           /  |  \         ~20% — Critical user flows
          /   |   \
         /─────────\
        /   API      \     API Tests (Playwright request context)
       /   Testing    \    ~40% — Contract, validation, edge cases
      /───────────────\
     /   Performance   \   Performance (K6)
    /───────────────────\  ~40% — Load, stress, spike
```

### 4.2 Test Types by Layer

#### E2E — Playwright

| Suite | App | Priority | Tags |
|-------|-----|----------|------|
| Smoke | All | P0 | `@smoke` |
| Happy Path — Market | Market | P1 | `@market @e2e` |
| Booking Flow — Hotel | Hotel | P1 | `@hotel @e2e` |
| RBAC — TaskTracker | TaskTracker | P1 | `@rbac @e2e` |
| Chaos Mode — Crypto | Crypto | P2 | `@chaos @e2e` |
| UI Component Library — Sandbox | Sandbox | P3 | `@sandbox @ui` |

#### API Tests

| Suite | Focus | Tags |
|-------|-------|------|
| Auth endpoints | Login, register, token validation | `@auth @api` |
| Market CRUD | Products, basket, orders — happy path + edge cases | `@market @api` |
| Hotel CRUD | Rooms, bookings, stays, reviews | `@hotel @api` |
| Bank operations | Accounts, transfers, bills, loans | `@bank @api` |
| Contract tests | JSON Schema validation | `@contract @api` |
| Security tests | Auth bypass, injection, CORS | `@security @api` |

#### Performance — K6

| Scenario | Type | Target | Duration |
|----------|------|--------|----------|
| Market Baseline | Load test | 50 VUs | 5 min |
| Market Load | Load test | 200 VUs | 10 min |
| Hotel Spike | Spike test | 500 VUs in 30s | 3 min |
| Bank Stress | Stress test | Ramp until failure | 15 min |
| API Soak | Soak test | 100 VUs sustained | 30 min |

### 4.3 Data Strategy

| Concern | Approach |
|---------|----------|
| State reset | `POST /api/reset` before each suite |
| Dynamic data | `faker-js` for unique values per run |
| Isolation | One API key per user = fully isolated environment |
| Cleanup | `afterEach` / `afterAll` via API calls |
| Static data | `/test-data/*.json` for fixed reference data |

---

## 5. Git Workflow

### 5.1 Branch Strategy

```
main                 ← production, always green
  └── develop        ← continuous integration
        ├── feature/ ← new test suites or features
        ├── fix/     ← broken or flaky test fixes
        ├── refactor/← improvements without behavior change
        ├── perf/    ← performance test changes
        └── chore/   ← config, dependencies, scripts
```

### 5.2 Branch Naming

```powershell
git checkout -b feature/market-basket-e2e-tests
git checkout -b fix/hotel-booking-flaky-test
git checkout -b refactor/page-objects-base-class
git checkout -b chore/update-playwright-version
git checkout -b perf/bank-load-test-thresholds
git checkout -b docs/readme-professional-rewrite
```

### 5.3 Conventional Commits

```
<type>(<scope>): <short description in imperative>

[optional body]

[optional footer: refs, breaking changes]
```

| Type | When to use |
|------|-------------|
| `feat` | New test suite or new page object |
| `test` | Adding or modifying test cases |
| `fix` | Fixing a broken or flaky test |
| `refactor` | Improving code without changing behavior |
| `perf` | Performance tests or threshold changes |
| `chore` | Config, dependencies, scripts |
| `ci` | GitHub Actions workflow changes |
| `docs` | Documentation only |

**Examples:**

```powershell
git commit -m "test(market): add basket quantity validation edge cases"
git commit -m "feat(hotel): implement booking lifecycle E2E flow"
git commit -m "fix(bank): resolve flaky transfer test due to race condition"
git commit -m "perf(market): add load test with 200 VUs and SLA thresholds"
git commit -m "ci: add nightly full regression pipeline"
git commit -m "refactor(pages): extract common wait methods to BasePage"
git commit -m "docs: rewrite README in English with professional structure"
```

### 5.4 Pull Request Policy

Before opening a PR toward `develop`:

- Tests pass in CI (green pipeline)
- No conflicts with `develop`
- Clear description with context for the change
- Screenshots or videos attached if there are UI changes
- Allure report link attached when relevant

```powershell
# Sync with develop before pushing
git fetch origin
git rebase origin/develop
git push origin <your-branch-name>
```

### 5.5 Tags and Releases

```powershell
git tag -a v1.0.0 -m "Initial suite: Market E2E + API + Performance"
git tag -a v1.1.0 -m "Add Hotel E2E + Bank API + K6 stress tests"
git push origin --tags
```

---

## 6. CI/CD — GitHub Actions

### 6.1 Pipelines

| Workflow | Trigger | Estimated Duration |
|----------|---------|-------------------|
| `ci-pr-main.yml` | PR to `develop` / `main` | ~5 min |
| `e2e-tests.yml` | Push to `develop`, PR | ~8–12 min |
| `api-tests.yml` | Push to `develop`, PR | ~3–5 min |
| `performance-tests.yml` | Push to `main`, scheduled | ~20–30 min |
| `nightly-full.yml` | Scheduled — 2 AM UTC | ~45–60 min |

### 6.2 Parallelization Strategy

| Layer | Strategy |
|-------|----------|
| E2E Tests | Sharded: shard 1/3 → market · shard 2/3 → hotel + bank · shard 3/3 → sandbox + tasktracker |
| API Tests | Parallel by module: market, hotel, bank run concurrently |
| K6 Tests | Sequential — performance tests must not run concurrently |

### 6.3 Required GitHub Secrets

Configure in **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `QACLOUD_API_KEY` | Your qacloud.dev API key |
| `QACLOUD_USERNAME` | Username for UI login |
| `QACLOUD_PASSWORD` | Password for UI login |
| `QACLOUD_BASE_URL` | `https://www.qacloud.dev` |

---

## 7. Allure Reporting

### 7.1 Report Structure

```
Allure Report
├── Overview (main dashboard)
├── Suites
│   ├── E2E
│   │   ├── Market
│   │   └── Hotel (upcoming)
│   └── API
│       ├── Market
│       └── Contracts
├── Behaviors  (Epics → Features → Stories)
│   ├── Epic: Market App
│   │   ├── Feature: Product Management
│   │   └── Feature: Order Management
│   └── Epic: Hotel App (upcoming)
├── Graphs     (trends, duration, retries)
└── Timeline
```

### 7.2 Allure Annotations in Playwright

```typescript
test('add product to basket updates item count', async ({ page }) => {
  await allure.epic('Market App');
  await allure.feature('Basket Management');
  await allure.story('Add product to basket');
  await allure.severity('critical');
  await allure.tag('smoke', 'market', 'basket');
  await allure.parameter('product', 'Organic Milk');

  // test steps...
});
```

### 7.3 Publishing

Allure reports are published automatically to **GitHub Pages** after every nightly run and every merge to `main`.

🔗 **Live report:** `https://martineez99.github.io/qacloud-qa-project/`

---

## 8. Environment Configuration

### 8.1 Prerequisites

```powershell
# Node.js >= 20 LTS
node --version

# K6
winget install k6 --source winget

# Java 21 (required by Allure CLI)
winget install Microsoft.OpenJDK.21

# Allure CLI
npm install -g allure-commandline
```

### 8.2 NPM Scripts

```json
{
  "scripts": {
    "test:e2e":          "playwright test --config=config/playwright.config.ts",
    "test:e2e:headed":   "playwright test --headed",
    "test:e2e:market":   "playwright test src/e2e/market/",
    "test:e2e:hotel":    "playwright test src/e2e/hotel/",
    "test:api":          "playwright test --config=config/playwright.api.config.ts src/api/",
    "test:smoke":        "playwright test --grep @smoke",
    "test:perf":         "k6 run src/performance/scenarios/market-load.js",
    "test:perf:stress":  "k6 run src/performance/scenarios/bank-stress.js",
    "report:generate":   "allure generate reports/allure-results -o reports/allure-report --clean",
    "report:open":       "allure open reports/allure-report",
    "report:serve":      "allure serve reports/allure-results",
    "lint":              "eslint src/ --ext .ts",
    "format":            "prettier --write src/"
  }
}
```

### 8.3 `playwright.config.ts` Key Settings

```typescript
// Base URL for Market tests
baseURL: process.env.QACLOUD_BASE_URL + '/market'

// Recommended timeout (stock validation can be slow)
timeout: 30000
```

### 8.4 API Authentication

```typescript
// All Market API requests require:
headers: {
  'Authorization': process.env.QACLOUD_API_KEY
}
```

---

## 9. Conventions and Standards

### 9.1 Naming Conventions

```
Files:     kebab-case          market-basket.spec.ts
Classes:   PascalCase          class MarketPage {}
Tests:     descriptive English test('place order with empty basket returns 400', ...)
Variables: camelCase           const basketTotal = await page.getBasketTotal();
```

### 9.2 Test Structure — AAA Pattern

Every test follows the Arrange / Act / Assert pattern:

```typescript
test('place order clears basket automatically', async ({ marketPage, apiClient }) => {
  // ── ARRANGE ──────────────────────────────────────
  await apiClient.reset();
  const product = await apiClient.getFirstProduct();
  await apiClient.addToBasket(product.id, 2);

  // ── ACT ──────────────────────────────────────────
  await marketPage.navigateToBasket();
  await marketPage.placeOrder();

  // ── ASSERT ───────────────────────────────────────
  await expect(marketPage.basketItems).toHaveCount(0);
  await expect(marketPage.emptyBasketMessage).toBeVisible();
});
```

### 9.3 Page Object Model Standard

```typescript
// BasePage.ts — all POMs inherit from this
export class BasePage {
  constructor(protected page: Page) {}

  async waitForNetworkIdle() { ... }
  async takeScreenshot(name: string) { ... }
  async scrollToElement(locator: Locator) { ... }
}

// MarketPage.ts
export class MarketPage extends BasePage {
  // Locators as getters — never raw selectors in test files
  get productCards() { return this.page.locator('[data-testid="product-card"]'); }
  get basketTotal()  { return this.page.locator('[data-testid="basket-total"]'); }

  // Actions as methods
  async addProductToBasket(productName: string) { ... }
  async placeOrder() { ... }
  async resetCatalog() { ... }
}
```

### 9.4 API Test Standard

```typescript
test.describe('Market Products API', () => {
  test.beforeAll(async ({ request }) => {
    await request.post('/api/reset', { headers: authHeaders });
  });

  test('GET /api/groceries returns 200 with products array', async ({ request }) => {
    const response = await request.get('/api/groceries', { headers: authHeaders });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products[0]).toMatchObject(productSchema); // contract check
  });
});
```

### 9.5 K6 Test Standard

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const listProductsDuration = new Trend('list_products_duration');

export const options = {
  stages: [
    { duration: '2m', target: 50 },  // ramp up
    { duration: '5m', target: 50 },  // sustained load
    { duration: '2m', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // SLA: 95th percentile under 500ms
    errors:            ['rate<0.01'], // error rate under 1%
  },
};
```

### 9.6 Expected Status Codes

```
Products:  201 (create) | 200 (read/update/delete) | 400 (invalid input) | 401 (auth) | 404 (not found)
Basket:    201 (add)    | 200 (read/update/delete) | 400 (stock/qty)     | 404 (product not found)
Orders:    201 (place)  | 200 (read/update/delete) | 400 (empty basket / invalid status)
Reset:     200
```

---

## 10. Implementation Roadmap

### Sprint 1 — Foundation ✅ Complete

```
[✅] Repository and folder structure initialized
[✅] TypeScript, ESLint, Prettier configured
[✅] Playwright configured (playwright.config.ts)
[✅] BasePage and base fixture implemented
[✅] API client wrapper implemented
[✅] Allure reporter configured
[✅] .env.example and PowerShell scripts created
[✅] Smoke tests — login + navigation
[✅] Basic CI pipeline (e2e-tests.yml)
```

### Sprint 2 — Market App ✅ Complete

```
[✅] Page Objects: MarketPage, BasketPage, OrdersPage
[✅] E2E tests: Products tab flow
[✅] E2E tests: Complete purchase journey (basket → order)
[✅] API tests: Market CRUD — happy path
[✅] API tests: Edge cases (stock validation, empty basket, cascade delete)
[✅] API tests: Orders edge cases (price snapshot, status, cascade)
[✅] Contract tests: JSON Schema for Market API
[✅] K6: Market baseline load test (50 VUs · 7 min)
[✅] Allure Report published to GitHub Pages
[✅] Nightly pipeline with automatic report publishing
[✅] Professional README
```

### Sprint 3 — Hotel + Bank 🔲 In Progress

```
[ ] Page Objects: HotelPage, BookingPage, BankPage
[ ] E2E tests: Hotel booking lifecycle
[ ] API tests: Hotel — rooms, bookings, reviews
[ ] API tests: Bank — accounts, transfers, edge cases
[ ] K6: Hotel spike test + Bank stress test
[ ] Pipeline: api-tests.yml (hotel + bank modules)
[ ] Pipeline: performance-tests.yml
```

### Sprint 4 — Advanced Patterns 🔲 Planned

```
[ ] Chaos testing — Crypto Simulator (WebSocket)
[ ] Security test suite (auth bypass, injection)
[ ] Visual regression testing
[ ] RBAC tests — TaskTracker
[ ] Nightly pipeline expanded to all suites
[ ] Final documentation pass
```

---

## References

| Resource | URL |
|----------|-----|
| QA Cloud Platform | https://www.qacloud.dev |
| Playwright Docs | https://playwright.dev/docs/intro |
| K6 Docs | https://k6.io/docs/ |
| Allure Playwright | https://allurereport.org/docs/playwright/ |
| Conventional Commits | https://www.conventionalcommits.org |
| GitHub Actions Docs | https://docs.github.com/en/actions |

---

*Living document — update as the project evolves.*
*Stack: Playwright · TypeScript · K6 · Allure · GitHub Actions*