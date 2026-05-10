# 🧪 QA Cloud — Automation Project

> A senior-level test automation suite built against [qacloud.dev](https://www.qacloud.dev/) — a purpose-built platform for QA practice. The project covers end-to-end UI testing, REST API testing, contract validation, and performance testing, all wired into a full CI/CD pipeline with live Allure reporting.

[![E2E Tests](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/e2e-tests.yml)
[![API Tests](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/api-tests.yml/badge.svg)](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/api-tests.yml)
[![Performance Tests](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/performance-tests.yml/badge.svg)](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/performance-tests.yml)
[![Nightly](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/nightly-full.yml/badge.svg)](https://github.com/Martineez99/qacloud-qa-project/actions/workflows/nightly-full.yml)
[![Allure Report](https://img.shields.io/badge/Allure-Live%20Report-orange)](https://martineez99.github.io/qacloud-qa-project/)
![Playwright](https://img.shields.io/badge/Playwright-1.44+-45ba4b?logo=playwright&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![K6](https://img.shields.io/badge/K6-Performance-7d64ff?logo=k6&logoColor=white)

---

## 📌 What This Project Is

This is not a tutorial project. It is a **real test automation suite** built incrementally, following the same practices and standards a QA team would apply in a professional environment:

- Tests are organized by **layer** (E2E / API / Performance) and by **application domain**
- The **Page Object Model** is implemented with a shared `BasePage` and typed locators
- API tests include both **happy path and edge case coverage**, plus **JSON Schema contract validation**
- Performance tests use **K6 with custom metrics and SLA thresholds**, not just basic load scripts
- The CI/CD pipeline has **separate workflows** per test type, a PR-gate pipeline, and a scheduled nightly run
- **Allure reports** are published automatically to GitHub Pages after every pipeline run

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| **This README** | Setup, commands and contribution guide |
| [`QA_PROJECT_ARCHITECTURE.md`](./docs/QA_PROJECT_ARCHITECTURE.md) | Full architecture, standards, testing strategy and roadmap |

---

## 🎯 Applications Under Test

| App | Path | Test types |
|-----|------|------------|
| **Market** | `/market/*` | E2E · API · Contract · Performance |
| **Hotel** | `/hotel/*` | E2E · API · Chaos *(in progress)* |
| **Bank** | `/bank/*` | API · Performance *(in progress)* |
| **TaskTracker** | `/tasks/*` | E2E · RBAC *(planned)* |
| **UI Sandbox** | `/sandbox/*` | Page Object base library |

---

## ✅ Current Coverage

### E2E — Playwright

| Suite | File | Status |
|-------|------|--------|
| Smoke — Login form | `e2e/smoke/login.spec.ts` | ✅ Done |
| Smoke — Navigation | `e2e/smoke/navigation.spec.ts` | ✅ Done |
| Market — Products tab | `e2e/market/products.spec.ts` | ✅ Done |
| Market — Basket flow | `e2e/market/basket.spec.ts` | ✅ Done |

### API — Playwright (request context)

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
| `nightly-full.yml` | Scheduled — 2AM UTC | ✅ Active |

---

## 📁 Project Structure

```
qacloud-qa-project/
│
├── .github/
│   └── workflows/
│       ├── ci-pr-main.yml          # PR gate: runs on every pull request
│       ├── e2e-tests.yml           # E2E pipeline with browser matrix
│       ├── api-tests.yml           # API pipeline, runs in parallel by module
│       ├── performance-tests.yml   # K6 performance pipeline
│       └── nightly-full.yml        # Full regression + Allure publish
│
├── src/
│   ├── e2e/
│   │   ├── smoke/                  # Login + navigation smoke tests
│   │   └── market/                 # Products and basket E2E flows
│   │
│   ├── api/
│   │   ├── market/                 # Products, basket, orders — happy + edge cases
│   │   └── contracts/              # JSON Schema contract tests
│   │
│   ├── performance/
│   │   ├── scenarios/              # K6 load scenarios
│   │   ├── thresholds/             # SLA configuration (p95, error rate)
│   │   └── data/                   # Test data for K6 VUs
│   │
│   ├── pages/                      # Page Object Model
│   │   ├── common/                 # BasePage, NavigationComponent
│   │   └── market/                 # MarketPage, BasketPage, OrdersPage
│   │
│   ├── fixtures/                   # Playwright fixtures and auth setup
│   ├── utils/                      # API client, data factory, custom assertions
│   └── types/                      # TypeScript interfaces for all domains
│
├── config/
│   └── playwright.config.ts        # Multi-project config (E2E + API + setups)
│
├── test-data/                      # Static test data (JSON)
├── scripts/                        # PowerShell utility scripts
├── reports/                        # Generated automatically — gitignored
├── .env.example                    # Environment variables template
└── package.json
```

---

## ⚙️ Prerequisites

```powershell
# Node.js >= 20 LTS
node --version

# Install K6 (Windows)
winget install k6 --source winget

# Install Java 21 (required by Allure CLI)
winget install Microsoft.OpenJDK.21

# Install Allure CLI globally
npm install -g allure-commandline
```

---

## 🚀 Setup

```powershell
# 1. Clone the repository
git clone https://github.com/Martineez99/qacloud-qa-project.git
Set-Location qacloud-qa-project

# 2. Install dependencies
npm install

# 3. Install Playwright browsers
npx playwright install --with-deps chromium firefox

# 4. Configure environment variables
Copy-Item .env.example .env
notepad .env   # Fill in your qacloud.dev credentials
```

### Environment Variables (`.env`)

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

> ⚠️ `.env` is listed in `.gitignore`. **Never commit it.** Use `.env.example` as the template.

---

## ▶️ Running Tests

### E2E (Playwright)

```powershell
# All E2E tests
npm run test:e2e

# Smoke tests only (P0)
npm run test:smoke

# Specific suite
npm run test:e2e:market

# With visible browser
npx playwright test src/e2e/market/ --headed --slowMo=500

# Debug a single test
npx playwright test src/e2e/market/basket.spec.ts --debug

# Parallel execution with sharding
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```

### API Tests

```powershell
# All API tests
npm run test:api

# With verbose output
npx playwright test src/api/ --reporter=list
```

### Performance (K6)

```powershell
# Market baseline load test
npm run test:perf

# Custom run
k6 run --vus 100 --duration 10m src/performance/scenarios/market-load.js
```

---

## 📊 Allure Reporting

Reports are published automatically to **GitHub Pages** after every nightly run and every merge to `main`.

🔗 **[View Live Allure Report](https://martineez99.github.io/qacloud-qa-project/)**

To generate and view the report locally:

```powershell
# Generate from results
npm run report:generate

# Open in browser
npm run report:open

# Serve directly from raw results (useful while tests are running)
npm run report:serve
```

Reports include test results grouped by Epic → Feature → Story, screenshots and videos on failure, environment metadata, and trend graphs across pipeline runs.

---

## 🔄 Git Workflow

This project follows **GitHub Flow** with Conventional Commits.

### Branch naming

```
feature/market-basket-e2e-tests
fix/hotel-booking-flaky-test
refactor/page-objects-base-class
chore/update-playwright-version
perf/bank-load-test-thresholds
```

### Commit format

```powershell
git commit -m "test(market): add basket quantity validation edge cases"
git commit -m "feat(hotel): implement booking lifecycle E2E flow"
git commit -m "fix(bank): resolve flaky transfer test due to race condition"
git commit -m "perf(market): add K6 baseline with SLA thresholds"
git commit -m "ci: add nightly regression pipeline with GitHub Pages publish"
```

**Allowed types:** `feat` · `test` · `fix` · `refactor` · `perf` · `chore` · `ci` · `docs`

### Pull Request checklist

Before opening a PR toward `develop`:

- [ ] Tests pass in CI (green pipeline)
- [ ] No conflicts with `develop`
- [ ] Clear description with context for the change
- [ ] Screenshots / videos attached if there are UI changes
- [ ] Allure report attached if relevant

```powershell
# Sync with develop before pushing
git fetch origin
git rebase origin/develop
git push origin feature/your-branch-name
```

### Tags and releases

```powershell
git tag -a v1.0.0 -m "Initial suite: Market E2E + API + Performance"
git push origin --tags
```

---

## 🔐 GitHub Actions Secrets

Configure these in **Settings → Secrets and variables → Actions** of your repository:

| Secret | Description |
|--------|-------------|
| `QACLOUD_API_KEY` | Your qacloud.dev API key |
| `QACLOUD_USERNAME` | Username for UI login |
| `QACLOUD_PASSWORD` | Password for UI login |
| `QACLOUD_BASE_URL` | `https://www.qacloud.dev` |

---

## 🛠️ Other Useful Commands

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

## 🗺️ Roadmap

The project is built iteratively. Market app coverage is complete. Next phases:

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

## 📎 Resources

| Resource | Link |
|----------|------|
| Platform under test | [qacloud.dev](https://www.qacloud.dev/) |
| Swagger — Market API | [/market/docs](https://www.qacloud.dev/market/docs) |
| Live Allure Report | [GitHub Pages](https://martineez99.github.io/qacloud-qa-project/) |
| Playwright Docs | [playwright.dev](https://playwright.dev/docs/intro) |
| K6 Docs | [k6.io/docs](https://k6.io/docs/) |
| Allure Playwright | [allurereport.org](https://allurereport.org/docs/playwright/) |
| Conventional Commits | [conventionalcommits.org](https://www.conventionalcommits.org) |

---

*Built step by step — prioritizing quality over quantity.*  
*Stack: Playwright · TypeScript · K6 · Allure · GitHub Actions · Windows PowerShell*