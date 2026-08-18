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

/**
 * Thresholds de Hotel — SPIKE TEST, no load test.
 * Más laxos que marketThresholds a propósito: un spike test asume cierta
 * degradación bajo el pico de 500 VUs; lo que nos interesa es que el
 * sistema no se caiga y se recupere, no que mantenga la misma latencia
 * que bajo carga sostenida moderada.
 *
 * ⚠️ Valores iniciales/hipótesis — documentados en
 * docs/HOTEL_PERFORMANCE_PLAN.md §5. Pendientes de validar contra la
 * primera ejecución real y ajustar si hace falta.
 *
 * hotel_error_rate → nuestra métrica custom basada en checks fallidos
 * (mismo patrón que market_error_rate)
 *
 * Umbrales por endpoint (Trend metrics), todos prefijados con "hotel_"
 * para no colisionar con las métricas de Market en el mismo proyecto K6:
 * - hotel_list_properties_duration    → GET /api/hotel/properties     target < 1000ms p95 (dataset pequeño, 5 seed)
 * - hotel_list_room_types_duration    → GET /api/hotel/room-types     target < 1200ms p95 (dataset algo mayor, 14 seed)
 * - hotel_list_bookings_duration      → GET /api/hotel/bookings       target < 800ms p95  (vacío/mínimo tras reset)
 * - hotel_check_availability_duration → GET /api/hotel/availability   target < 1800ms p95 (endpoint nuevo, sin baseline previa)
 */
export const hotelThresholds = {
  // Global
  http_req_duration: ['p(95)<3000', 'p(99)<4500'],
  http_req_failed:   ['rate<0.03'],
  hotel_error_rate:  ['rate<0.03'],

  // Por endpoint
  hotel_list_properties_duration:    ['p(95)<1000'],
  hotel_list_room_types_duration:    ['p(95)<1200'],
  hotel_list_bookings_duration:      ['p(95)<800'],
  hotel_check_availability_duration: ['p(95)<1800'],
};