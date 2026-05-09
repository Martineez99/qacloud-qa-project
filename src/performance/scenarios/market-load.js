/**
 * Market Baseline Load Test
 *
 * Objetivo: establecer el punto de referencia de rendimiento de la Market API
 * bajo carga moderada y sostenida. Solo operaciones de lectura para métricas
 * limpias sin efectos secundarios de escritura.
 *
 * Distribución de tráfico:
 *   50% → GET /api/groceries           (el endpoint más llamado)
 *   30% → GET /api/groceries/filter    (ejercita filtros multi-parámetro)
 *   20% → GET /api/basket              (consulta de estado)
 *
 * Perfil de carga:
 *   Ramp-up:   1 min   0 → 50 VUs
 *   Sustained: 5 min   50 VUs constantes
 *   Ramp-down: 1 min   50 → 0 VUs
 *   Total:     7 min
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { marketThresholds } from '../thresholds/sla-config.js';

// ─── Init context: se ejecuta UNA VEZ por VU antes de que empiece el test ──
// open() solo está disponible aquí, no dentro de funciones
const testData = JSON.parse(open('../data/test-data.json'));

const BASE_URL = __ENV.QACLOUD_BASE_URL || 'https://www.qacloud.dev';
const API_KEY  = __ENV.QACLOUD_API_KEY;

// ─── Métricas custom ───────────────────────────────────────────────────────
// Trend: registra la distribución de tiempos por endpoint (p50, p95, p99...)
// Rate:  registra el porcentaje de checks que fallan
const listProductsTrend   = new Trend('list_products_duration',   true);
const filterProductsTrend = new Trend('filter_products_duration', true);
const getBasketTrend      = new Trend('get_basket_duration',      true);
const errorRate           = new Rate('market_error_rate');

// ─── Opciones del test ─────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '1m', target: 50 },  // ramp-up: incorporar VUs gradualmente
    { duration: '5m', target: 50 },  // sustained: carga estable, aquí medimos
    { duration: '1m', target: 0  },  // ramp-down: bajar limpiamente
  ],
  thresholds: marketThresholds,
};

// ─── Headers compartidos por todos los VUs ─────────────────────────────────
const headers = {
  Authorization: API_KEY,
  'Content-Type': 'application/json',
};

// ─── Helper ────────────────────────────────────────────────────────────────
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Escenario A: listar todos los productos (50%) ─────────────────────────
function listProducts() {
  group('List Products', () => {
    const res = http.get(
      `${BASE_URL}/api/groceries`,
      { headers, tags: { endpoint: 'list_products' } }
    );

    const httpSuccess = check(res, {
      'list products: status is 200': (r) => r.status === 200,
    });
    check(res, {
      'list products: response time < 1500ms': (r) => r.timings.duration < 1500,
    });

    listProductsTrend.add(res.timings.duration);
    errorRate.add(!httpSuccess);
  });
}

// ─── Escenario B: filtrar productos (30%) ──────────────────────────────────
function filterProducts() {
  group('Filter Products', () => {
    const combo = randomItem(testData.filterCombinations);
    const url   = `${BASE_URL}/api/groceries/filter?category=${combo.category}&sort=${combo.sort}`;

    const res = http.get(
      url,
      { headers, tags: { endpoint: 'filter_products' } }
    );

    const httpSuccess = check(res, {
      'filter products: status is 200': (r) => r.status === 200,
    });
    check(res, {
      'filter products: response time < 1500ms': (r) => r.timings.duration < 1500,
    });

    filterProductsTrend.add(res.timings.duration);
    errorRate.add(!httpSuccess);
  });
}
// ─── Escenario C: consultar cesta (20%) ────────────────────────────────────
function getBasket() {
  group('Get Basket', () => {
    const res = http.get(
      `${BASE_URL}/api/basket`,
      { headers, tags: { endpoint: 'get_basket' } }
    );

    const httpSuccess = check(res, {
      'get basket: status is 200': (r) => r.status === 200,
    });
    check(res, {
      'get basket: response time < 2000ms': (r) => r.timings.duration < 2000,
    });

    getBasketTrend.add(res.timings.duration);
    errorRate.add(!httpSuccess);
  });
}


// ─── Función principal: K6 la ejecuta en bucle por cada VU ────────────────
export default function () {
  const roll = Math.random();

  if (roll < 0.50) {
    listProducts();
  } else if (roll < 0.80) {
    filterProducts();
  } else {
    getBasket();
  }

  // Think time: simula la pausa real entre acciones de un usuario
  // Entre 1 y 3 segundos aleatorio → evita que todos los VUs lleguen sincronizados
  sleep(Math.random() * 2 + 1);
}