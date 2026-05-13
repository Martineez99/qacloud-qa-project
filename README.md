# QA Cloud — Test Automation Suite

> A senior-level test automation suite built against [qacloud.dev](https://www.qacloud.dev/) — a purpose-built platform for QA practice. The project covers end-to-end UI testing, REST API testing, contract validation, and performance testing, all wired into a full CI/CD pipeline with live Allure reporting published to GitHub Pages.

[![E2E Tests](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/e2e-tests.yml)
[![API Tests](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/api-tests.yml/badge.svg)](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/api-tests.yml)
[![Performance Tests](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/performance-tests.yml/badge.svg)](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/performance-tests.yml)
[![Nightly](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/nightly-full.yml/badge.svg)](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/nightly-full.yml)
[![Allure Report](https://img.shields.io/badge/Allure-Live%20Report-orange)](https://martineez99.github.io/qacloud-qa-project/)
![Playwright](https://img.shields.io/badge/Playwright-1.44+-45ba4b?logo=playwright&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![K6](https://img.shields.io/badge/K6-Performance-7d64ff?logo=k6&logoColor=white)

---

## What This Project Demonstrates

This is not a tutorial or a course exercise. It is a **real-world test automation suite** built incrementally, following the same standards a professional QA team would apply:

- **Layered testing strategy** — E2E, API, contract, and performance tests are kept separate, each with its own pipeline, runner, and reporting scope.
- **Page Object Model** with a typed `BasePage`, shared fixtures, and domain-specific page classes. No duplicated locators, no raw selectors in test files.
- **API test design** that goes beyond happy paths — stock validation edge cases, price snapshot integrity, cascade delete behavior, and basket merge logic all have dedicated coverage.
- **JSON Schema contract testing** to catch breaking API changes before they reach UI tests.
- **K6 performance tests** with custom metrics, SLA thresholds, and staged load profiles — not just a default `k6 run`.
- **CI/CD pipeline** with separate workflows per layer, a PR gate, and a scheduled nightly full regression that publishes an Allure report to GitHub Pages automatically.

---

## Tech Stack

| Tool | Version | Role |
|------|---------|------|
| [Playwright](https://playwright.dev) | `^1.44` | E2E tests, API tests, browser automation |
| TypeScript | `^5.x` | Typed test code across the entire suite |
| [K6](https://k6.io) | latest | Load, stress, and spike testing |
| [Allure](https://allurereport.org) | `^3.x` | Unified test reporting |
| GitHub Actions | — | CI/CD pipelines, scheduled runs, Pages publish |
| Node.js | `>= 20 LTS` | Runtime |

---

## Coverage

### E2E — Playwright

| Suite | File | Status |
|-------|------|--------|
| Smoke — Login form | `e2e/smoke/login.spec.ts` | ✅ Done |
| Smoke — Navigation | `e2e/smoke/navigation.spec.ts` | ✅ Done |
| Market — Products tab | `e2e/market/products.spec.ts` | ✅ Done |
| Market — Basket flow | `e2e/market/basket.spec.ts` | ✅ Done |

### API — Playwright request context

| Suite | File | Status |
|-------|------|--------|
| Products — CRUD + edge cases | `api/market/products.api.spec.ts` | ✅ Done |
| Basket — core flow | `api/market/basket.api.spec.ts` | ✅ Done |
| Basket — edge cases (stock, merge, limits) | `api/market/basket-edge-cases.api.spec.ts` | ✅ Done |
| Orders — core flow | `api/market/orders.api.spec.ts` | ✅ Done |
| Orders — edge cases (snapshot, status, cascade) | `api/market/orders-edge-cases.api.spec.ts` | ✅ Done |
| Contract tests — JSON Schema | `api/contracts/market.contract.spec.ts` | ✅ Done |

### Performance — K6

| Scenario | File | Profile | Status |
|----------|------|---------|--------|
| Market baseline load | `performance/scenarios/market-load.js` | 50 VUs · 7 min | ✅ Done |

### CI/CD — GitHub Actions

| Workflow | Trigger | Status |
|----------|---------|--------|
| `ci-pr-main.yml` | PR to `develop` / `main` | ✅ Active |
| `e2e-tests.yml` | Push to `develop`, PR | ✅ Active |
| `api-tests.yml` | Push to `develop`, PR | ✅ Active |
| `performance-tests.yml` | Push to `main`, scheduled | ✅ Active |
| `nightly-full.yml` | Scheduled — 2 AM UTC | ✅ Active |

---

## Project Structure

```
qacloud-qa-project/
│
├── .github/workflows/          # CI/CD pipelines (E2E, API, Performance, Nightly)
│
├── src/
│   ├── e2e/                    # End-to-end tests (smoke + market)
│   ├── api/                    # API + contract tests
│   │   ├── market/             # Products, basket, orders — happy path + edge cases
│   │   └── contracts/          # JSON Schema contract validation
│   ├── performance/            # K6 load scenarios, SLA thresholds, test data
│   ├── pages/                  # Page Object Model (BasePage + domain pages)
│   │   ├── common/             # BasePage, NavigationComponent
│   │   └── market/             # MarketPage, BasketPage, OrdersPage
│   ├── fixtures/               # Playwright fixtures and auth setup
│   ├── utils/                  # API client, data factory, custom assertions
│   └── types/                  # TypeScript interfaces for all domains
│
├── config/
│   └── playwright.config.ts    # Multi-project config (E2E + API + setups)
│
├── test-data/                  # Static test data (JSON)
├── scripts/                    # PowerShell utility scripts
└── .env.example                # Environment variables template
```

---

## Setup

### Prerequisites

```powershell
# Node.js >= 20 LTS
node --version

# Install K6
winget install k6 --source winget

# Install Java 21 (required by Allure CLI)
winget install Microsoft.OpenJDK.21

# Install Allure CLI globally
npm install -g allure-commandline
```

### Installation

```powershell
# 1. Clone the repository
git clone https://github.com/Martineez99/qacloud-qa-project.git
Set-Location qacloud-qa-project

# 2. Install dependencies
npm install

# 3. Install Playwright browsers
npx playwright install --with-deps chromium firefox

# 4. Set up environment variables
Copy-Item .env.example .env
notepad .env   # Fill in your qacloud.dev credentials
```

### Environment Variables

```env
QACLOUD_BASE_URL=https://www.qacloud.dev
QACLOUD_API_KEY=qac_live_xxxxxxxxxxxx
QACLOUD_USERNAME=your_username
QACLOUD_PASSWORD=your_password

TEST_TIMEOUT=30000
HEADLESS=true
SLOW_MO=0

K6_VUS=50
K6_DURATION=5m
```

> ⚠️ `.env` is gitignored. Never commit credentials. Use `.env.example` as the template.

---

## Running Tests

### E2E

```powershell
# Full E2E suite
npm run test:e2e

# Smoke tests only (P0)
npm run test:smoke

# Market suite
npm run test:e2e:market

# Headed mode for debugging
npx playwright test src/e2e/market/ --headed --slowMo=500

# Debug a single spec
npx playwright test src/e2e/market/basket.spec.ts --debug

# Parallel execution via sharding
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```

### API

```powershell
# Full API suite
npm run test:api

# Verbose output
npx playwright test src/api/ --reporter=list
```

### Performance

```powershell
# Market baseline
npm run test:perf

# Custom parameters
k6 run --vus 100 --duration 10m src/performance/scenarios/market-load.js
```

---

## Reporting

Allure reports are **published automatically to GitHub Pages** after every nightly run and every merge to `main`.

🔗 **[View Live Allure Report](https://martineez99.github.io/qacloud-qa-project/)**

Reports include results grouped by Epic → Feature → Story, screenshots and videos on failure, environment metadata, and trend graphs across pipeline runs.

```powershell
# Generate report locally from raw results
npm run report:generate

# Open generated report in browser
npm run report:open

# Serve directly while tests are running
npm run report:serve
```

---

## Git Workflow

This project follows **GitHub Flow** with [Conventional Commits](https://www.conventionalcommits.org).

```
main        ← production, always green
  └── develop  ← continuous integration
        ├── feature/
        ├── fix/
        ├── refactor/
        └── chore/
```

**Branch naming:** `feature/market-basket-e2e-tests`, `fix/hotel-booking-flaky-test`, `perf/bank-load-test-thresholds`

**Commit format:**

```powershell
git commit -m "test(market): add basket quantity validation edge cases"
git commit -m "feat(hotel): implement booking lifecycle E2E flow"
git commit -m "ci: add nightly regression pipeline with GitHub Pages publish"
```

**Allowed types:** `feat` · `test` · `fix` · `refactor` · `perf` · `chore` · `ci` · `docs`

---

## Documentation

| Document | Description |
|----------|-------------|
| **README** *(this file)* | Project overview, setup, and usage |
| [`docs/QA_PROJECT_ARCHITECTURE.md`](./docs/QA_PROJECT_ARCHITECTURE.md) | Full architecture, testing strategy, standards, and roadmap |
| [`docs/MARKET_APP_CONTEXT.md`](./docs/MARKET_APP_CONTEXT.md) | Application under test — endpoints, test cases, and QA context |

---

## GitHub Actions Secrets

Configure in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `QACLOUD_API_KEY` | Your qacloud.dev API key |
| `QACLOUD_USERNAME` | Username for UI login |
| `QACLOUD_PASSWORD` | Password for UI login |
| `QACLOUD_BASE_URL` | `https://www.qacloud.dev` |

---

## Roadmap

Sprint 2 (Market app) is complete. Next phases:

```
Sprint 3 — Hotel + Bank
  [ ] Hotel E2E: booking lifecycle
  [ ] Hotel API: rooms, bookings, reviews
  [ ] Bank API: transfers, accounts, edge cases
  [ ] K6: hotel spike test + bank stress test

Sprint 4 — Advanced Patterns
  [ ] Chaos testing (Crypto Simulator — WebSocket)
  [ ] Security test suite (auth bypass, injection)
  [ ] Visual regression testing
  [ ] RBAC tests (TaskTracker)
```

---

## Other Useful Commands

```powershell
# Inspect a trace from a failed test
npx playwright show-trace reports/traces/trace.zip

# Lint the codebase
npm run lint

# Format code
npm run format

# Reset test data on the platform
.\scripts\reset-test-data.ps1
```

---

## Resources

| Resource | Link |
|----------|------|
| Platform under test | [qacloud.dev](https://www.qacloud.dev/) |
| Swagger — Market API | [/market/docs](https://www.qacloud.dev/market/docs) |
| Live Allure Report | [GitHub Pages](https://martineez99.github.io/qacloud-qa-project/) |
| Playwright Docs | [playwright.dev](https://playwright.dev/docs/intro) |
| K6 Docs | [k6.io/docs](https://k6.io/docs/) |
| Allure Playwright | [allurereport.org](https://allurereport.org/docs/playwright/) |

---

*Stack: Playwright · TypeScript · K6 · Allure · GitHub Actions*