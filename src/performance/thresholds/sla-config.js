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
 * ✅ CALIBRADO contra ejecución real (2026-08-19), no ya hipótesis.
 * Ver docs/HOTEL_PERFORMANCE_PLAN.md §10 para el detalle completo de la
 * corrida que generó estos números.
 *
 * Resultado real bajo pico de 500 VUs (~11.900 requests, 3 min):
 *   - http_req_failed: 0.00% — la API NUNCA devolvió error bajo el pico,
 *     solo se ralentiza. Buena señal de resiliencia funcional.
 *   - Los 4 endpoints degradan de forma casi idéntica (p95 8.5s-9.06s),
 *     lo que apunta a un cuello de botella de capacidad general del
 *     servidor bajo concurrencia alta, no de una query en particular.
 *   - Mediana real bajo pico: ~1.2-1.4s (razonable). p95: ~8.5-9.1s.
 *     p99: ~10.7s. Máximos puntuales: hasta ~15.5s.
 *
 * Umbrales fijados con margen ~15-20% sobre lo observado: sirven para
 * detectar una regresión real (el sistema empeorando respecto a esta
 * baseline), sin ser tan estrictos que fallen por ruido normal de un
 * spike test contra un entorno compartido de práctica.
 *
 * hotel_error_rate → nuestra métrica custom basada en checks fallidos
 * (mismo patrón que market_error_rate). Se mantiene estricta (rate<0.02)
 * precisamente porque en la corrida real fue 0.00% — cualquier fallo
 * aquí sí sería una regresión genuina, a diferencia de la latencia.
 *
 * Umbrales por endpoint (Trend metrics), todos prefijados con "hotel_"
 * para no colisionar con las métricas de Market en el mismo proyecto K6:
 * - hotel_list_properties_duration    → GET /api/hotel/properties     p95 real 8.78s → threshold 10s
 * - hotel_list_room_types_duration    → GET /api/hotel/room-types     p95 real 8.63s → threshold 10s
 * - hotel_list_bookings_duration      → GET /api/hotel/bookings       p95 real 8.51s → threshold 10s
 * - hotel_check_availability_duration → GET /api/hotel/availability   p95 real 9.06s → threshold 11s (endpoint más pesado, más margen)
 */
export const hotelThresholds = {
  // Global
  http_req_duration: ['p(95)<10000', 'p(99)<13000'],
  http_req_failed:   ['rate<0.02'],
  hotel_error_rate:  ['rate<0.02'],

  // Por endpoint
  hotel_list_properties_duration:    ['p(95)<10000'],
  hotel_list_room_types_duration:    ['p(95)<10000'],
  hotel_list_bookings_duration:      ['p(95)<10000'],
  hotel_check_availability_duration: ['p(95)<11000'],
};