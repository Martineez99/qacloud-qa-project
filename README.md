# 🧪 QA Cloud — Automation Project

> Proyecto de automatización QA de nivel senior sobre la plataforma [qacloud.dev](https://www.qacloud.dev/)

![Playwright](https://img.shields.io/badge/Playwright-1.44+-45ba4b?logo=playwright&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![K6](https://img.shields.io/badge/K6-Performance-7d64ff?logo=k6&logoColor=white)
![Allure](https://img.shields.io/badge/Allure-Reporting-orange)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-CI%2FCD-2088ff?logo=githubactions&logoColor=white)

---

## 📖 Documentación

| Documento | Descripción |
|-----------|-------------|
| **Este README** | Setup, comandos y guía de contribución |
| [`QA_PROJECT_ARCHITECTURE.md`](./QA_PROJECT_ARCHITECTURE.md) | Arquitectura completa, estándares, estrategia y roadmap |

---

## 🎯 Aplicaciones bajo prueba

| App | Ruta | Tipo de test |
|-----|------|--------------|
| **Market** | `/market/*` | E2E · API · Performance |
| **Hotel** | `/hotel/*` | E2E · API · Chaos |
| **Bank** | `/bank/*` | API · Performance |
| **TaskTracker** | `/tasks/*` | E2E · RBAC |
| **UI Sandbox** | `/sandbox/*` | Page Objects base |

---

## ⚙️ Prerequisitos

Asegúrate de tener instalado en **Windows**:

```powershell
# Verificar Node.js >= 20
node --version

# Instalar K6
winget install k6 --source winget

# Instalar Java 21 (requerido por Allure CLI)
winget install Microsoft.OpenJDK.21

# Instalar Allure CLI globalmente
npm install -g allure-commandline
```

---

## 🚀 Setup del proyecto

```powershell
# 1. Clonar el repositorio
git clone https://github.com/<org>/qacloud-qa-project.git
Set-Location qacloud-qa-project

# 2. Instalar dependencias
npm install

# 3. Instalar browsers de Playwright
npx playwright install --with-deps chromium firefox

# 4. Configurar variables de entorno
Copy-Item .env.example .env
notepad .env   # Añade tus credenciales de qacloud.dev
```

### Variables de entorno (`.env`)

```env
QACLOUD_BASE_URL=https://www.qacloud.dev
QACLOUD_API_KEY=qac_live_xxxxxxxxxxxx
QACLOUD_USERNAME=tu_usuario
QACLOUD_PASSWORD=tu_password

TEST_TIMEOUT=30000
HEADLESS=true
SLOW_MO=0

K6_VUS=50
K6_DURATION=5m
```

> ⚠️ El archivo `.env` está en `.gitignore`. **Nunca lo commitees.** Usa `.env.example` como plantilla.

---

## ▶️ Ejecutar tests

### E2E (Playwright)

```powershell
# Todos los tests E2E
npm run test:e2e

# Solo smoke tests (P0)
npm run test:smoke

# Suite específica
npm run test:e2e:market
npm run test:e2e:hotel

# Con navegador visible
npx playwright test src/e2e/market/ --headed --slowMo=500

# Debug de un test concreto
npx playwright test src/e2e/market/basket.spec.ts --debug

# Ejecución en paralelo con sharding
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```

### API Tests

```powershell
# Todos los API tests
npm run test:api

# Con output detallado
npx playwright test src/api/ --reporter=list
```

### Performance (K6)

```powershell
# Load test básico (Market)
npm run test:perf

# Stress test (Bank)
npm run test:perf:stress

# Personalizado
k6 run --vus 100 --duration 10m src/performance/scenarios/market-load.js
```

---

## 📊 Reportes Allure

```powershell
# Generar reporte desde los resultados
npm run report:generate

# Abrir el reporte en el navegador
npm run report:open

# Servir en vivo mientras los tests corren
npm run report:serve
```

> El reporte HTML se publica automáticamente en **GitHub Pages** tras cada push a `main`.

---

## 🔄 Flujo de trabajo Git

Este proyecto sigue **GitHub Flow** con Conventional Commits.

### Crear una rama

```powershell
# Patrón: <tipo>/<app>-<descripcion-corta>
git checkout -b feature/market-basket-e2e-tests
git checkout -b fix/hotel-booking-flaky-test
git checkout -b perf/bank-load-test-thresholds
git checkout -b chore/update-playwright-version
```

### Commit con Conventional Commits

```powershell
git add .
git commit -m "test(market): add basket quantity validation edge cases"
git commit -m "feat(hotel): implement booking lifecycle E2E flow"
git commit -m "fix(bank): resolve flaky transfer test due to race condition"
git commit -m "ci: add nightly full regression pipeline"
```

**Tipos de commit permitidos:** `feat` · `test` · `fix` · `refactor` · `perf` · `chore` · `ci` · `docs`

### Pull Request

```powershell
# Asegúrate de estar actualizado con develop antes de abrir PR
git fetch origin
git rebase origin/develop

git push origin feature/market-basket-e2e-tests
# Luego abre el PR en GitHub hacia develop
```

**Checklist antes de abrir un PR:**
- [ ] Tests pasan en CI (pipeline verde)
- [ ] Sin conflictos con `develop`
- [ ] Descripción clara con contexto del cambio
- [ ] Screenshots/videos si hay cambios en UI
- [ ] Allure report adjunto si aplica

### Tags y releases

```powershell
git tag -a v1.0.0 -m "Initial suite: Market + Hotel E2E + API"
git push origin --tags
```

---

## 🏗️ Estructura del proyecto (resumen)

```
qacloud-qa-project/
├── src/
│   ├── e2e/          # Tests E2E por app (Playwright)
│   ├── api/          # Tests de API + contract testing
│   ├── performance/  # Escenarios K6
│   ├── pages/        # Page Object Model
│   ├── fixtures/     # Fixtures y setup global
│   └── utils/        # API client, helpers, data factory
├── config/           # Configuraciones Playwright y K6
├── test-data/        # Datos estáticos de prueba
├── scripts/          # Scripts PowerShell de utilidad
├── .github/
│   └── workflows/    # CI/CD pipelines
└── reports/          # Generado automáticamente (gitignored)
```

> Para la arquitectura completa consulta [`QA_PROJECT_ARCHITECTURE.md`](./QA_PROJECT_ARCHITECTURE.md)

---

## 🔐 Secrets en GitHub Actions

Configura estos secrets en **Settings → Secrets and variables → Actions** de tu repo:

| Secret | Descripción |
|--------|-------------|
| `QACLOUD_API_KEY` | API key de qacloud.dev |
| `QACLOUD_USERNAME` | Usuario para login UI |
| `QACLOUD_PASSWORD` | Contraseña para login UI |
| `QACLOUD_BASE_URL` | `https://www.qacloud.dev` |

---

## 🛠️ Otros comandos útiles

```powershell
# Ver traza de un test fallido
npx playwright show-trace reports/traces/trace.zip

# Lint del código
npm run lint

# Formatear código
npm run format

# Reset del estado de datos en la plataforma
.\scripts\reset-test-data.ps1
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

---

*Stack: Playwright · TypeScript · K6 · Allure · GitHub Actions · Windows PowerShell*
