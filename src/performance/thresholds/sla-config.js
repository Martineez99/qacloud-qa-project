/**
 * SLA Thresholds centralizados para todos los tests K6.
 * Importar en cada escenario para mantener estándares consistentes.
 *
 * http_req_duration   → tiempo de respuesta de TODAS las requests
 * http_req_failed     → métrica nativa K6: requests que fallaron (non-2xx o errores de red)
 * market_error_rate   → nuestra métrica custom basada en checks fallidos
 *
 * Umbrales por endpoint (Trend metrics):
 * - list_products_duration    → GET /api/groceries        target < 3000ms p95
 * - filter_products_duration  → GET /api/groceries/filter target < 3000ms p95
 * - get_basket_duration       → GET /api/basket           target < 3000ms p95
 */
export const marketThresholds = {
  // Global
  http_req_duration:  ['p(95)<3000', 'p(99)<4000'],
  http_req_failed:    ['rate<0.01'],
  market_error_rate:  ['rate<0.01'],   // ahora solo trackea fallos HTTP reales

  // Por endpoint
  list_products_duration:   ['p(95)<3000'],
  filter_products_duration: ['p(95)<3000'],
  get_basket_duration:      ['p(95)<3000'],
};

/**
 * Thresholds de Hotel — SPIKE TEST, no load test.
 * Más laxos que marketThresholds a propósito: un spike test asume cierta
 * degradación bajo el pico de 500 VUs; lo que nos interesa es que el
 * sistema no se caiga y se recupere, no que mantenga la misma latencia
 * que bajo carga sostenida moderada.
 *
 * Calibrado con las últimas ejecuciones reales (2026-10-26); la baseline
 * anterior (2026-08-19) ya no representaba la latencia actual del entorno.
 * Ver docs/HOTEL_PERFORMANCE_PLAN.md §10 para los resultados.
 *
 * La latencia se conserva como métrica informativa, sin thresholds que
 * bloqueen CI: las ejecuciones del entorno de demo son muy variables.
 * Los errores funcionales siguen bloqueando CI con un límite del 2%.
 *
 * Las Trends hotel_*_duration y http_req_duration siguen recogiendo
 * percentiles y se muestran en el resumen de K6.
 */
export const hotelThresholds = {
  http_req_failed:  ['rate<0.02'],
  hotel_error_rate: ['rate<0.02'],
};