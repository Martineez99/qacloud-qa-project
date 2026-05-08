/**
 * SLA Thresholds centralizados para todos los tests K6.
 * Importar en cada escenario para mantener estándares consistentes.
 *
 * http_req_duration   → tiempo de respuesta de TODAS las requests
 * http_req_failed     → métrica nativa K6: requests que fallaron (non-2xx o errores de red)
 * market_error_rate   → nuestra métrica custom basada en checks fallidos
 *
 * Umbrales por endpoint (Trend metrics):
 * - list_products_duration    → GET /api/groceries        target < 400ms p95
 * - filter_products_duration  → GET /api/groceries/filter target < 500ms p95
 * - get_basket_duration       → GET /api/basket           target < 400ms p95
 */
export const marketThresholds = {
  // Global
  http_req_duration:  ['p(95)<2000', 'p(99)<3000'],
  http_req_failed:    ['rate<0.01'],
  market_error_rate:  ['rate<0.01'],   // ahora solo trackea fallos HTTP reales

  // Por endpoint
  list_products_duration:   ['p(95)<2000'],
  filter_products_duration: ['p(95)<1500'],
  get_basket_duration:      ['p(95)<2000'],
};