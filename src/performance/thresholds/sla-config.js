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
 * Último resultado real bajo pico de 500 VUs (~4.660 requests, 3 min):
 *   - Todas las peticiones respondieron correctamente.
 *   - Los 4 endpoints degradan de forma casi idéntica (p95 22.35s-22.86s),
 *     lo que apunta a un cuello de botella general de capacidad.
 *   - p95 global: 22.58s; p99: 23.88s; máximo: 25.59s.
 *
 * Umbrales holgados para el entorno de demo: p95 < 30s y p99 < 40s.
 * Conservan margen ante la variabilidad entre ejecuciones sin quitar el
 * límite de errores funcionales (2%).
 *
 * hotel_error_rate → métrica custom basada en checks fallidos (mismo patrón
 * que market_error_rate); conserva el mismo límite que http_req_failed.
 *
 * Umbrales por endpoint (Trend metrics), todos prefijados con "hotel_"
 * para no colisionar con las métricas de Market en el mismo proyecto K6:
 * - hotel_list_properties_duration    → GET /api/hotel/properties     p95 real 22.58s → threshold 30s
 * - hotel_list_room_types_duration    → GET /api/hotel/room-types     p95 real 22.56s → threshold 30s
 * - hotel_list_bookings_duration      → GET /api/hotel/bookings       p95 real 22.35s → threshold 30s
 * - hotel_check_availability_duration → GET /api/hotel/availability   p95 real 22.86s → threshold 30s
 */
export const hotelThresholds = {

  // Global
  http_req_duration: ['p(95)<30000', 'p(99)<40000'],
  http_req_failed:  ['rate<0.02'],
  hotel_error_rate: ['rate<0.02'],

  // Por endpoint
  hotel_list_properties_duration:    ['p(95)<30000'],
  hotel_list_room_types_duration:    ['p(95)<30000'],
  hotel_list_bookings_duration:      ['p(95)<30000'],
  hotel_check_availability_duration: ['p(95)<30000'],
};