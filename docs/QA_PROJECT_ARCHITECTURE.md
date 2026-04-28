# 🧪 QA Cloud — Proyecto Senior de Automatización

> **Plataforma objetivo:** [qacloud.dev](https://www.qacloud.dev/)  
> **Stack de testing:** Playwright · API Testing (nativo) · K6 · Allure · GitHub Actions  
> **Nivel:** Senior QA Engineer  
> **Comandos de terminal:** Windows PowerShell

---

## 📋 Índice

1. [Análisis de la Plataforma](#1-análisis-de-la-plataforma)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Estrategia de Testing](#4-estrategia-de-testing)
5. [Flujo de Trabajo Git (GitHub Flow Senior)](#5-flujo-de-trabajo-git-github-flow-senior)
6. [CI/CD con GitHub Actions](#6-cicd-con-github-actions)
7. [Reporting con Allure](#7-reporting-con-allure)
8. [Configuración del Entorno](#8-configuración-del-entorno)
9. [Convenciones y Estándares](#9-convenciones-y-estándares)
10. [Roadmap de Implementación](#10-roadmap-de-implementación)

---

## 1. Análisis de la Plataforma

### 1.1 Aplicaciones Disponibles

| App | Ruta | Nivel | Tipo | Casos de Prueba Clave |
|-----|------|-------|------|-----------------------|
| **Market** | `/market/*` | All levels | E-commerce | CRUD productos, basket, órdenes, stock, roles |
| **Hotel** | `/hotel/*` | Intermediate | Reservas | Booking lifecycle, chaos testing, reviews |
| **Bank** | `/bank/*` | Intermediate | Finanzas | Transfers, loans, concurrencia, overdraft |
| **TaskTracker** | `/tasks/*` | All levels | RBAC | Transiciones de estado, permisos, forbidden actions |
| **Rental** | `/rental/*` | Intermediate | Car rental | Inventory conflicts, date validation, admin ops |
| **UI Sandbox** | `/sandbox/*` | All levels | UI pura | Forms, modals, dropdowns, dynamic elements |
| **Crypto Simulator** | `/crypto.html` | Intermediate | WebSocket | Race conditions, chaos injection, float bugs |
| **SeatMatrix** | `/seatmatrix.html` | Intermediate | Tickets | Multi-step booking, seat availability |
| **Data Integrity Hub** | `/datahub.html` | Intermediate | CSV/Excel | Data migration, import/export testing |

### 1.2 APIs con Swagger Docs

Cada aplicación expone su Swagger en `/<app>/docs`:

| API | Swagger URL | Autenticación |
|-----|-------------|---------------|
| Market | `/market/docs` | `Authorization: qac_live_...` |
| Hotel | `/hotel/docs` | `Authorization: qac_live_...` |
| Bank | `/bank/docs` | `Authorization: qac_live_...` |
| TaskTracker | `/tasks/docs` | `Authorization: qac_live_...` |
| Rental | `/rental/docs` | `Authorization: qac_live_...` |
| SeatMatrix | `/ticket/docs` | `Authorization: qac_live_...` |

### 1.3 Utilidades de Testing

| Herramienta | URL | Uso en QA |
|-------------|-----|-----------|
| JSON Diff | `/tools/json-diff.html` | Comparar respuestas API |
| Credit Card Generator | `/tools/credit-card-generator.html` | Datos de prueba para pagos |
| ID Generator | `/tools/id-generator.html` | AAMVA barcodes para testing |
| Barcode Generator | `/tools/barcode-generator.html` | UPC-A, Code-128, QR |

### 1.4 Características Especiales para QA

- **Chaos Mode:** El Crypto Simulator permite inyectar latencia, crashes y payloads malformados
- **Bugs Intencionales:** Todas las apps tienen bugs documentados para practicar detección
- **Data Isolation:** Cada usuario tiene entorno aislado (safe para tests destructivos)
- **Reset Endpoint:** `POST /api/reset` para estado determinista en cada test suite
- **RBAC en múltiples apps:** Roles diferenciados (admin, user, member)
- **WebSocket testing:** Crypto Simulator con live BTC/USD feed
- **Edge Cases documentados:** Stock validation, price snapshots, concurrencia

### 1.5 Foco Principal del Proyecto

Nos centraremos en **3 aplicaciones core** que cubren todos los patrones importantes:

```
🛒 Market  →  E2E + API + Performance (más completa, CRUD completo)
🏨 Hotel   →  E2E + API + Chaos Testing (booking lifecycle)
🏦 Bank    →  API + Performance (concurrencia, edge cases financieros)
```

El **UI Sandbox** se usará para construir la librería de Page Objects reutilizables.

---

## 2. Stack Tecnológico

```
qacloud-qa-project/
│
├── 🎭 Playwright (TypeScript)
│   └── E2E tests, API tests integrados, visual testing
│
├── 🌊 K6 (JavaScript)
│   └── Load testing, stress testing, spike testing
│
├── 📊 Allure Framework
│   └── Reporting unificado para Playwright + K6
│
├── 🔄 GitHub Actions
│   └── CI/CD pipeline, matrix strategy, scheduled runs
│
└── 🐳 Docker (opcional, para entorno local reproducible)
```

### Versiones

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Node.js | `>= 20.x LTS` | Runtime |
| TypeScript | `^5.x` | Tipado estático |
| Playwright | `^1.44+` | E2E + API |
| @playwright/test | `^1.44+` | Test runner |
| K6 | `latest` | Performance |
| allure-playwright | `^3.x` | Allure para Playwright |
| allure-commandline | `^2.x` | Generar reportes |
| dotenv | `^16.x` | Variables de entorno |
| faker-js | `^8.x` | Generación de datos |

---

## 3. Estructura del Proyecto

```
qacloud-qa-project/
│
├── 📁 .github/
│   ├── 📁 workflows/
│   │   ├── e2e-tests.yml          # Pipeline E2E
│   │   ├── api-tests.yml          # Pipeline API
│   │   ├── performance-tests.yml  # Pipeline K6
│   │   └── nightly-full.yml       # Ejecución completa nocturna
│   ├── 📁 ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── test_case.md
│   └── pull_request_template.md
│
├── 📁 src/
│   │
│   ├── 📁 e2e/                    # Tests E2E con Playwright
│   │   ├── 📁 market/
│   │   │   ├── products.spec.ts
│   │   │   ├── basket.spec.ts
│   │   │   └── orders.spec.ts
│   │   ├── 📁 hotel/
│   │   │   ├── booking.spec.ts
│   │   │   └── rooms.spec.ts
│   │   ├── 📁 bank/
│   │   │   └── transfers.spec.ts
│   │   ├── 📁 tasktracker/
│   │   │   └── workflow.spec.ts
│   │   └── 📁 sandbox/
│   │       ├── forms.spec.ts
│   │       ├── modals.spec.ts
│   │       └── dynamic-elements.spec.ts
│   │
│   ├── 📁 api/                    # Tests de API pura
│   │   ├── 📁 market/
│   │   │   ├── products.api.spec.ts
│   │   │   ├── basket.api.spec.ts
│   │   │   └── orders.api.spec.ts
│   │   ├── 📁 hotel/
│   │   │   ├── bookings.api.spec.ts
│   │   │   └── rooms.api.spec.ts
│   │   ├── 📁 bank/
│   │   │   ├── accounts.api.spec.ts
│   │   │   └── transfers.api.spec.ts
│   │   ├── 📁 auth/
│   │   │   └── auth.api.spec.ts
│   │   └── 📁 contracts/          # Contract testing (JSON Schemas)
│   │       ├── market.schema.ts
│   │       └── hotel.schema.ts
│   │
│   ├── 📁 performance/            # Tests de Performance con K6
│   │   ├── 📁 scenarios/
│   │   │   ├── market-load.js
│   │   │   ├── hotel-spike.js
│   │   │   └── bank-stress.js
│   │   ├── 📁 thresholds/
│   │   │   └── sla-config.js      # Definición de SLAs
│   │   └── 📁 data/
│   │       └── test-data.json     # Dataset para K6
│   │
│   ├── 📁 pages/                  # Page Object Model
│   │   ├── 📁 market/
│   │   │   ├── MarketPage.ts
│   │   │   ├── BasketPage.ts
│   │   │   └── OrdersPage.ts
│   │   ├── 📁 hotel/
│   │   │   ├── HotelPage.ts
│   │   │   └── BookingPage.ts
│   │   ├── 📁 bank/
│   │   │   └── BankPage.ts
│   │   ├── 📁 common/
│   │   │   ├── LoginPage.ts
│   │   │   ├── NavigationComponent.ts
│   │   │   └── BasePage.ts        # Clase base con métodos comunes
│   │   └── 📁 sandbox/
│   │       ├── FormsPage.ts
│   │       └── ComponentsPage.ts
│   │
│   ├── 📁 fixtures/               # Fixtures y setup global
│   │   ├── base.fixture.ts        # Fixture base (extiende Playwright)
│   │   ├── auth.fixture.ts        # Fixture de autenticación
│   │   └── api.fixture.ts         # Fixture para API client
│   │
│   ├── 📁 utils/
│   │   ├── api-client.ts          # Cliente HTTP wrapper
│   │   ├── auth-helper.ts         # Helpers de autenticación
│   │   ├── data-factory.ts        # Generación de test data con Faker
│   │   ├── assertions.ts          # Custom assertions
│   │   └── logger.ts              # Logger para tests
│   │
│   └── 📁 types/
│       ├── market.types.ts        # Interfaces TypeScript para Market
│       ├── hotel.types.ts
│       ├── bank.types.ts
│       └── common.types.ts
│
├── 📁 config/
│   ├── playwright.config.ts       # Config principal Playwright
│   ├── playwright.api.config.ts   # Config específica API tests
│   └── k6.config.js               # Config K6 compartida
│
├── 📁 test-data/
│   ├── users.json                 # Usuarios de prueba
│   ├── products.json              # Productos seed
│   └── bookings.json              # Reservas de prueba
│
├── 📁 reports/                    # Generado automáticamente
│   ├── 📁 allure-results/         # Raw results (gitignored)
│   └── 📁 allure-report/          # HTML report (gitignored)
│
├── 📁 scripts/
│   ├── setup.ps1                  # Setup inicial del proyecto
│   ├── run-tests.ps1              # Script para ejecutar suites
│   ├── generate-report.ps1        # Generar Allure report
│   └── reset-test-data.ps1        # Reset datos en plataforma
│
├── .env                           # Variables locales (gitignored)
├── .env.example                   # Template de variables
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── tsconfig.json
├── package.json
└── README.md
```

---

## 4. Estrategia de Testing

### 4.1 Pirámide de Testing

```
         ▲
        /|\
       / | \           🔺 E2E (Playwright)
      /  |  \          ~20% — Flujos críticos de usuario
     /   |   \
    /────────\
   /    API   \        🔶 API Tests (Playwright request)
  /  Testing   \       ~40% — Contrato, validación, edge cases
 /─────────────\
/  Unit / Perf  \      🟦 Performance (K6)
/───────────────\      ~40% — Load, stress, spike
```

### 4.2 Tipos de Test por Capa

#### 🎭 E2E con Playwright

| Suite | App | Prioridad | Tags |
|-------|-----|-----------|------|
| Smoke | Todas | P0 | `@smoke` |
| Happy Path Market | Market | P1 | `@market @e2e` |
| Booking Flow Hotel | Hotel | P1 | `@hotel @e2e` |
| RBAC TaskTracker | TaskTracker | P1 | `@rbac @e2e` |
| Chaos Mode Crypto | Crypto | P2 | `@chaos @e2e` |
| UI Sandbox Components | Sandbox | P3 | `@sandbox @ui` |

#### 🔌 API Tests

| Suite | Enfoque | Tags |
|-------|---------|------|
| Auth endpoints | Login, register, token validation | `@auth @api` |
| Market CRUD | Products, basket, orders — happy + edge | `@market @api` |
| Hotel CRUD | Rooms, bookings, stays, reviews | `@hotel @api` |
| Bank operations | Accounts, transfers, bills, loans | `@bank @api` |
| Contract tests | JSON Schema validation | `@contract @api` |
| Security tests | Auth bypass, injection, CORS | `@security @api` |

#### 🌊 Performance con K6

| Escenario | Tipo | Target | Duración |
|-----------|------|--------|----------|
| Market Baseline | Load test | 50 VUs | 5 min |
| Market Load | Load test | 200 VUs | 10 min |
| Hotel Spike | Spike test | 500 VUs en 30s | 3 min |
| Bank Stress | Stress test | Incremento hasta fail | 15 min |
| API Soak | Soak test | 100 VUs constantes | 30 min |

### 4.3 Estrategia de Datos

```
┌─────────────────────────────────────────────────────┐
│                  Test Data Strategy                  │
├─────────────────┬───────────────────────────────────┤
│ SETUP           │ POST /api/reset antes de cada suite│
│ GENERATION      │ faker-js para datos dinámicos      │
│ ISOLATION       │ API key por usuario = entorno aislado│
│ CLEANUP         │ afterEach / afterAll con API calls │
│ STATIC DATA     │ /test-data/*.json para datos fijos │
└─────────────────┴───────────────────────────────────┘
```

---

## 5. Flujo de Trabajo Git (GitHub Flow Senior)

### 5.1 Estrategia de Branches

```
main                    ← Producción, siempre verde
  └── develop           ← Integración continua
        ├── feature/    ← Nuevas funcionalidades de testing
        ├── fix/        ← Corrección de tests
        ├── refactor/   ← Mejoras sin cambio de tests
        └── chore/      ← Configuración, dependencias
```

### 5.2 Nomenclatura de Branches

```powershell
# Patrón: <tipo>/<app>-<descripcion-corta>
git checkout -b feature/market-basket-e2e-tests
git checkout -b fix/hotel-booking-flaky-test
git checkout -b refactor/page-objects-base-class
git checkout -b chore/update-playwright-version
git checkout -b perf/bank-load-test-thresholds
```

### 5.3 Conventional Commits

```
<tipo>(<scope>): <descripción en imperativo>

[cuerpo opcional]

[footer: refs, breaking changes]
```

**Tipos permitidos:**

| Tipo | Uso |
|------|-----|
| `feat` | Nueva suite de tests o página nueva |
| `test` | Añadir/modificar test cases |
| `fix` | Corregir test roto o flaky test |
| `refactor` | Mejorar código sin cambiar comportamiento |
| `perf` | Tests de performance, thresholds |
| `chore` | Config, deps, scripts |
| `ci` | Cambios en GitHub Actions |
| `docs` | Documentación |

**Ejemplos:**

```bash
git commit -m "test(market): add basket quantity validation edge cases"
git commit -m "feat(hotel): implement booking lifecycle E2E flow"
git commit -m "fix(bank): resolve flaky transfer test due to race condition"
git commit -m "perf(market): add load test with 200 VUs and SLA thresholds"
git commit -m "ci: add nightly full regression pipeline"
git commit -m "refactor(pages): extract common wait methods to BasePage"
```

### 5.4 Pull Request Policy

```
┌─────────────────────────────────────────────────────┐
│                  PR Requirements                     │
├─────────────────────────────────────────────────────┤
│ ✅ Tests pasan en CI (verde)                        │
│ ✅ Mínimo 1 reviewer aprueba                        │
│ ✅ No hay conflictos con develop                    │
│ ✅ Descripción completa con contexto                │
│ ✅ Screenshots/videos si hay cambios en UI           │
│ ✅ Allure report adjunto en descripción             │
└─────────────────────────────────────────────────────┘
```

### 5.5 Tags y Releases

```powershell
# Versionar las suites de tests
git tag -a v1.0.0 -m "Initial test suite: Market + Hotel E2E + API"
git tag -a v1.1.0 -m "Add Bank API tests + K6 load tests"
git push origin --tags
```

---

## 6. CI/CD con GitHub Actions

### 6.1 Pipelines

#### `e2e-tests.yml` — Tests E2E

```yaml
# Triggers: PR a develop/main + push a develop
# Estrategia: Matrix por app (market, hotel, bank)
# Artifacts: videos, screenshots, allure-results
# Duración estimada: ~8-12 min
```

#### `api-tests.yml` — Tests de API

```yaml
# Triggers: PR a develop/main
# Estrategia: Secuencial por módulo
# Artifacts: allure-results, har files
# Duración estimada: ~3-5 min
```

#### `performance-tests.yml` — K6

```yaml
# Triggers: Solo push a main + schedule (nightly)
# Estrategia: Secuencial, no matrix (recursos)
# Artifacts: k6 summary JSON, allure-results
# Duración estimada: ~20-30 min
```

#### `nightly-full.yml` — Regresión Completa

```yaml
# Triggers: Schedule cron "0 2 * * *" (2AM UTC)
# Estrategia: Todas las suites en paralelo
# Artifacts: Allure report completo publicado en GitHub Pages
# Duración estimada: ~45-60 min
```

### 6.2 Secrets en GitHub

```
QACLOUD_API_KEY       ← Tu API key de qacloud.dev
QACLOUD_USERNAME      ← Username para login UI
QACLOUD_PASSWORD      ← Password para login UI
QACLOUD_BASE_URL      ← https://www.qacloud.dev
```

### 6.3 Estrategia de Paralelización

```
┌─────────────────────────────────────────────────┐
│  GitHub Actions Matrix Strategy                 │
├──────────────┬──────────────────────────────────┤
│ E2E Tests    │ shard 1/3: market                │
│              │ shard 2/3: hotel + bank           │
│              │ shard 3/3: sandbox + tasktracker  │
├──────────────┬──────────────────────────────────┤
│ API Tests    │ parallel: market, hotel, bank     │
├──────────────┬──────────────────────────────────┤
│ K6 Tests     │ sequential (no paralelizar)       │
└──────────────┴──────────────────────────────────┘
```

---

## 7. Reporting con Allure

### 7.1 Estructura de Categorías

```
Allure Report
├── 📊 Overview (dashboard principal)
├── 📋 Suites
│   ├── E2E
│   │   ├── Market
│   │   ├── Hotel
│   │   └── Bank
│   └── API
│       ├── Market
│       └── Hotel
├── 🏷️ Behaviors (Epics > Features > Stories)
│   ├── Epic: Market App
│   │   ├── Feature: Product Management
│   │   │   └── Story: Add product to basket
│   │   └── Feature: Order Management
│   └── Epic: Hotel App
├── 📈 Graphs (trends, duration, retries)
└── 🔗 Timeline
```

### 7.2 Decoradores Allure en Playwright

```typescript
// Ejemplo de anotaciones en test
test('add product to basket updates total', async ({ page }) => {
  await allure.epic('Market App');
  await allure.feature('Basket Management');
  await allure.story('Add product to basket');
  await allure.severity('critical');
  await allure.tag('smoke', 'market', 'basket');
  await allure.parameter('product', 'Organic Milk');
});
```

### 7.3 Publicación del Report

```
GitHub Pages ← allure-report/
  URL: https://<org>.github.io/<repo>/
  Actualización: Cada push a main + nightly run
```

---

## 8. Configuración del Entorno

### 8.1 Prerequisitos (Windows)

```powershell
# Verificar Node.js >= 20
node --version

# Instalar K6 (via winget o Chocolatey)
winget install k6 --source winget
# o con chocolatey:
choco install k6

# Instalar Java (para Allure CLI)
winget install Microsoft.OpenJDK.21

# Instalar Allure CLI
npm install -g allure-commandline
```

### 8.2 Inicialización del Proyecto

```powershell
# Clonar y configurar
git clone https://github.com/<org>/qacloud-qa-project.git
Set-Location qacloud-qa-project

# Instalar dependencias
npm install

# Instalar browsers de Playwright
npx playwright install --with-deps chromium firefox

# Configurar variables de entorno
Copy-Item .env.example .env
# Editar .env con tus credenciales de qacloud.dev
notepad .env
```

### 8.3 Variables de Entorno (`.env`)

```env
# qacloud.dev credentials
QACLOUD_BASE_URL=https://www.qacloud.dev
QACLOUD_API_KEY=qac_live_xxxxxxxxxxxx
QACLOUD_USERNAME=tu_usuario
QACLOUD_PASSWORD=tu_password

# Test configuration
TEST_TIMEOUT=30000
HEADLESS=true
SLOW_MO=0

# K6 configuration
K6_VUS=50
K6_DURATION=5m
```

### 8.4 Scripts NPM

```json
{
  "scripts": {
    "test:e2e": "playwright test --config=config/playwright.config.ts",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:market": "playwright test src/e2e/market/",
    "test:e2e:hotel": "playwright test src/e2e/hotel/",
    "test:api": "playwright test --config=config/playwright.api.config.ts src/api/",
    "test:smoke": "playwright test --grep @smoke",
    "test:perf": "k6 run src/performance/scenarios/market-load.js",
    "test:perf:stress": "k6 run src/performance/scenarios/bank-stress.js",
    "report:generate": "allure generate reports/allure-results -o reports/allure-report --clean",
    "report:open": "allure open reports/allure-report",
    "report:serve": "allure serve reports/allure-results",
    "lint": "eslint src/ --ext .ts",
    "format": "prettier --write src/"
  }
}
```

### 8.5 Comandos de Ejecución Frecuentes (PowerShell)

```powershell
# Ejecutar todos los E2E
npm run test:e2e

# Ejecutar solo smoke tests
npm run test:smoke

# Ejecutar tests de Market en modo headed (ver navegador)
npx playwright test src/e2e/market/ --headed --slowMo=500

# Ejecutar API tests con reporter verbose
npx playwright test src/api/ --reporter=list

# Ejecutar K6 load test
k6 run --vus 100 --duration 10m src/performance/scenarios/market-load.js

# Generar y abrir Allure report
npm run report:generate
npm run report:open

# Ejecutar con sharding (paralelización)
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3

# Debug un test específico
npx playwright test src/e2e/market/basket.spec.ts --debug

# Ver trace de una ejecución fallida
npx playwright show-trace reports/traces/trace.zip
```

---

## 9. Convenciones y Estándares

### 9.1 Naming Conventions

```typescript
// Archivos: kebab-case
market-basket.spec.ts
basket-page.ts

// Clases: PascalCase
class MarketPage {}
class BasketPage {}

// Tests: descripción clara en inglés
test('add product to basket updates item count', ...)
test('place order with empty basket returns 400', ...)

// Variables: camelCase
const productName = 'Organic Milk';
const basketTotal = await page.getBasketTotal();
```

### 9.2 Estructura de un Test (Patrón AAA)

```typescript
test('place order clears basket automatically', async ({ marketPage, apiClient }) => {
  // ── ARRANGE ────────────────────────────────────────
  await apiClient.reset();
  const product = await apiClient.getFirstProduct();
  await apiClient.addToBasket(product.id, 2);

  // ── ACT ────────────────────────────────────────────
  await marketPage.navigateToBasket();
  await marketPage.placeOrder();

  // ── ASSERT ─────────────────────────────────────────
  await expect(marketPage.basketItems).toHaveCount(0);
  await expect(marketPage.emptyBasketMessage).toBeVisible();
});
```

### 9.3 Page Object Model Standard

```typescript
// BasePage.ts — Todos los POM heredan de aquí
export class BasePage {
  constructor(protected page: Page) {}
  
  async waitForNetworkIdle() { ... }
  async takeScreenshot(name: string) { ... }
  async scrollToElement(locator: Locator) { ... }
}

// MarketPage.ts
export class MarketPage extends BasePage {
  // Locators como getters
  get productCards() { return this.page.locator('[data-testid="product-card"]'); }
  get basketTotal() { return this.page.locator('[data-testid="basket-total"]'); }
  
  // Actions como métodos
  async addProductToBasket(productName: string) { ... }
  async placeOrder() { ... }
  async resetCatalog() { ... }
}
```

### 9.4 API Test Standard

```typescript
// Cada suite de API tiene: setup → tests → teardown
test.describe('Market Products API', () => {
  let apiKey: string;
  
  test.beforeAll(async ({ request }) => {
    // Setup: reset state
    await request.post('/api/reset', { headers: authHeaders });
  });
  
  test('GET /api/groceries returns 200 with products array', async ({ request }) => {
    const response = await request.get('/api/groceries', { headers: authHeaders });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('products');
    expect(body.products).toBeArray();
    // Contract validation
    expect(body.products[0]).toMatchObject(productSchema);
  });
});
```

### 9.5 K6 Test Standard

```javascript
// market-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const listProductsDuration = new Trend('list_products_duration');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // ramp up
    { duration: '5m', target: 50 },   // sustained load
    { duration: '2m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // SLA: 95% < 500ms
    errors: ['rate<0.01'],             // Error rate < 1%
  },
};
```

---

## 10. Roadmap de Implementación

### Sprint 1 — Fundamentos (Semana 1-2)
```
[✅] Inicializar repositorio y estructura de carpetas
[✅] Configurar TypeScript, ESLint, Prettier
[✅] Configurar Playwright (playwright.config.ts)
[✅] Implementar BasePage y fixture base
[✅] Implementar API Client wrapper
[✅] Configurar Allure reporter
[✅] Crear .env.example y scripts PS1
[✅] Primeros smoke tests (login + navegación)
[ ] Pipeline CI básico (e2e-tests.yml)
```

### Sprint 2 — Market App (Semana 3-4)
```
[ ] Page Objects: MarketPage, BasketPage, OrdersPage
[ ] E2E tests: Products CRUD flow
[ ] E2E tests: Complete purchase journey
[ ] API tests: Market CRUD completo
[ ] API tests: Edge cases (stock validation, empty basket)
[ ] Contract tests: JSON Schema para Market API
[ ] K6: Market baseline load test
```

### Sprint 3 — Hotel + Bank (Semana 5-6)
```
[ ] Page Objects: HotelPage, BookingPage, BankPage
[ ] E2E tests: Hotel booking lifecycle
[ ] API tests: Hotel + Bank completos
[ ] K6: Hotel spike test + Bank stress test
[ ] Pipeline: api-tests.yml
[ ] Pipeline: performance-tests.yml
```

### Sprint 4 — Advanced (Semana 7-8)
```
[ ] Chaos testing con Crypto Simulator (WebSocket)
[ ] Security tests (auth bypass, injection)
[ ] Visual regression testing con Playwright
[ ] Nightly pipeline con GitHub Pages
[ ] RBAC tests en TaskTracker
[ ] Documentación final y README
```

---

## 📎 Referencias

| Recurso | URL |
|---------|-----|
| QA Cloud Platform | https://www.qacloud.dev |
| Playwright Docs | https://playwright.dev/docs/intro |
| K6 Docs | https://k6.io/docs/ |
| Allure Playwright | https://allurereport.org/docs/playwright/ |
| Conventional Commits | https://www.conventionalcommits.org |
| GitHub Actions Docs | https://docs.github.com/en/actions |

---

*Documento vivo — actualizar según evolucione el proyecto.*  
*Versión: 1.0.0 · Creado para qacloud.dev · Stack: Playwright + K6 + Allure + GitHub Actions*
