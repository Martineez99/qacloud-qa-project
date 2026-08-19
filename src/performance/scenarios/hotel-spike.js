/**
 * Hotel Spike Test
 *
 * Objetivo: medir cómo reacciona la Hotel API a un pico brusco de
 * concurrencia (500 VUs en 30s) y si se recupera al bajar la carga.
 * A diferencia de market-load.js (load test sostenido), este es un
 * SPIKE test: se espera cierta degradación durante el pico, lo que
 * importa es que no haya caída total y que recupere después.
 *
 * Distribución de tráfico (solo lectura, ver docs/HOTEL_PERFORMANCE_PLAN.md §3):
 *   25% → GET /api/hotel/properties
 *   25% → GET /api/hotel/room-types
 *   30% → GET /api/hotel/bookings       (con y sin ?status=)
 *   20% → GET /api/hotel/availability   (requiere property_id real)
 *
 * Perfil de carga (docs/HOTEL_PERFORMANCE_PLAN.md §2):
 *   Baseline:  10s    0  → 20  VUs
 *   Spike:     30s    20 → 500 VUs
 *   Sustain:   60s    500 VUs constantes
 *   Recovery:  60s    500 → 20 VUs
 *   Cooldown:  20s    20  VUs constantes
 *   Total:     180s (3 min)
 *
 * ✅ CONFIRMADO contra Swagger real (2026-08-18):
 *   - GET /api/hotel/availability usa check_in_date / check_out_date,
 *     NO check_in / check_out como documentaba (incorrectamente)
 *     HOTEL_APP_CONTEXT.md §6.4. Ya corregido en este script — pendiente
 *     de corregir también el .md (ver docs/HOTEL_PERFORMANCE_PLAN.md).
 *   - GET /api/hotel/properties admite filtros opcionales is_active y
 *     city (no usados aquí a propósito: el spike test quiere el listado
 *     completo, no filtrado).
 *
 * ✅ CONFIRMADO en ejecución real contra el servidor (no en Swagger):
 *   - GET /api/hotel/availability EXIGE también room_type_id, aunque no
 *     aparece listado como parámetro en el Swagger UI compartido. El
 *     servidor devuelve 400 con:
 *     {"error":"Property ID, room type ID, check-in date, and
 *      check-out date are required"}
 *     Discrepancia Swagger vs. validación real — pendiente de anotar en
 *     HOTEL_APP_CONTEXT.md §6.4 como hallazgo de QA.
 *
 * ⚠️ SUPUESTO SIN VERIFICAR TODAVÍA: el shape exacto del body de
 * respuesta de properties y room-types (¿array plano o { properties:
 * [...] } / { room_types: [...] }?) — Swagger UI no mostró el "Example
 * Value". El helper extractArray() soporta varias variantes como red de
 * seguridad, y setup() lanza un error explícito si no logra extraer IDs,
 * así que si el test arranca sin fallar aquí, el shape era compatible.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { hotelThresholds } from '../thresholds/sla-config.js';

// ─── Init context: se ejecuta UNA VEZ por VU antes de que empiece el test ──
const testData = JSON.parse(open('../data/hotel-test-data.json'));

const BASE_URL = __ENV.QACLOUD_BASE_URL || 'https://www.qacloud.dev';
const API_KEY  = __ENV.QACLOUD_API_KEY;

// ─── Métricas custom ───────────────────────────────────────────────────────
const listPropertiesTrend    = new Trend('hotel_list_properties_duration',    true);
const listRoomTypesTrend     = new Trend('hotel_list_room_types_duration',    true);
const listBookingsTrend      = new Trend('hotel_list_bookings_duration',      true);
const checkAvailabilityTrend = new Trend('hotel_check_availability_duration', true);
const errorRate              = new Rate('hotel_error_rate');

// ─── Opciones del test ─────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '10s', target: 20  },  // baseline
    { duration: '30s', target: 500 },  // SPIKE — coincide con la spec (500 VUs en 30s)
    { duration: '60s', target: 500 },  // sustain — ventana de medición bajo estrés máximo
    { duration: '60s', target: 20  },  // recovery — ¿se recupera al bajar la carga?
    { duration: '20s', target: 20  },  // cooldown — confirmar estabilidad tras el pico
  ],
  thresholds: hotelThresholds,
};

// ─── Headers compartidos por todos los VUs ─────────────────────────────────
const headers = {
  Authorization: API_KEY,
  'Content-Type': 'application/json',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Soporta tanto un array plano como un objeto envoltorio con distintas
// claves posibles ({ properties: [...] }, { room_types: [...] },
// { data: [...] }, etc.) hasta que se confirme el shape real contra Swagger.
function extractArray(body, candidateKeys) {
  if (Array.isArray(body)) return body;
  if (!body) return [];
  for (const key of candidateKeys) {
    if (Array.isArray(body[key])) return body[key];
  }
  if (Array.isArray(body.data)) return body.data;
  return [];
}

// Convierte un offset en días (desde "hoy") a formato YYYY-MM-DD.
function dateFromOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// ─── setup(): corre UNA SOLA VEZ antes de que arranquen los VUs ───────────
// Aquí, y no en un step de shell separado como en Market, porque necesitamos
// encadenar el reset con la captura de property_ids en la misma operación
// (ver docs/HOTEL_PERFORMANCE_PLAN.md §4.1/§4.2 y §7 sobre la diferencia con
// el step de reset por curl que usa k6-market-baseline).
export function setup() {
  // Log de diagnóstico: si QACLOUD_API_KEY no llegó (undefined), lo vemos
  // aquí antes de disparar ninguna request — evita perder tiempo con
  // errores 401 silenciosos.
  if (!API_KEY) {
    console.error(
      'setup(): QACLOUD_API_KEY no está definida en el entorno. ' +
      'Verifica $env:QACLOUD_API_KEY en la MISMA ventana de PowerShell ' +
      'donde ejecutas "k6 run".'
    );
  }
  console.log(`setup(): BASE_URL=${BASE_URL} API_KEY set=${Boolean(API_KEY)}`);

  const resetRes = http.post(`${BASE_URL}/api/hotel/reset`, null, { headers });
  const resetOk = check(resetRes, {
    'setup: reset status is 200': (r) => r.status === 200,
  });
  if (!resetOk) {
    console.error(
      `setup(): reset falló — status ${resetRes.status}, body: ${resetRes.body}`
    );
  }

  const propsRes = http.get(`${BASE_URL}/api/hotel/properties`, { headers });
  const propsOk = check(propsRes, {
    'setup: properties status is 200': (r) => r.status === 200,
  });
  if (!propsOk) {
    console.error(
      `setup(): GET properties falló — status ${propsRes.status}, body: ${propsRes.body}`
    );
  }

  let propertiesBody;
  try {
    propertiesBody = propsRes.json();
  } catch (e) {
    console.error(
      `setup(): la respuesta de properties no es JSON válido — ` +
      `probablemente un error 401/404 con body HTML. status=${propsRes.status}`
    );
    propertiesBody = [];
  }

  const properties = extractArray(propertiesBody, ['properties']);
  const propertyIds = properties.map((p) => p.id).filter(Boolean);

  if (propertyIds.length === 0) {
    // No hay properties tras el reset — algo va mal (¿reset falló? ¿shape
    // de la respuesta distinto al esperado?). Se detiene el test entero
    // para no correr un spike test inútil sin availability funcional.
    throw new Error(
      'setup(): no se obtuvo ningún property_id tras el reset. ' +
      'Revisa el shape real de GET /api/hotel/properties contra Swagger.'
    );
  }

  // ✅ CORRECCIÓN (encontrada en ejecución real, no en Swagger): el
  // Swagger de /api/hotel/availability solo lista property_id,
  // check_in_date y check_out_date como parámetros — pero el servidor
  // devuelve 400 exigiendo TAMBIÉN room_type_id:
  //   {"error":"Property ID, room type ID, check-in date, and
  //    check-out date are required"}
  // Pendiente de anotar esta discrepancia en HOTEL_APP_CONTEXT.md §6.4
  // (Swagger incompleto respecto a la validación real del servidor).
  const roomTypesRes = http.get(`${BASE_URL}/api/hotel/room-types`, { headers });
  const roomTypesOk = check(roomTypesRes, {
    'setup: room-types status is 200': (r) => r.status === 200,
  });
  if (!roomTypesOk) {
    console.error(
      `setup(): GET room-types falló — status ${roomTypesRes.status}, body: ${roomTypesRes.body}`
    );
  }

  let roomTypesBody;
  try {
    roomTypesBody = roomTypesRes.json();
  } catch (e) {
    console.error(
      `setup(): la respuesta de room-types no es JSON válido. status=${roomTypesRes.status}`
    );
    roomTypesBody = [];
  }

  const roomTypes = extractArray(roomTypesBody, ['room_types', 'roomTypes']);
  const roomTypeIds = roomTypes.map((rt) => rt.id).filter(Boolean);

  // Agrupamos room_type_id por property_id para que availability consulte
  // combinaciones coherentes (un room type que sí pertenece a la property
  // consultada), no pares aleatorios sin relación.
  const roomTypesByProperty = {};
  roomTypes.forEach((rt) => {
    const pid = rt.property_id || (rt.property && rt.property.id);
    if (!pid || !rt.id) return;
    if (!roomTypesByProperty[pid]) roomTypesByProperty[pid] = [];
    roomTypesByProperty[pid].push(rt.id);
  });

  if (roomTypeIds.length === 0) {
    throw new Error(
      'setup(): no se obtuvo ningún room_type_id. ' +
      'GET /api/hotel/availability necesita este parámetro (confirmado en ' +
      'ejecución real, no documentado en Swagger) — revisa el shape real ' +
      'de GET /api/hotel/room-types.'
    );
  }

  return { propertyIds, roomTypeIds, roomTypesByProperty };
}

// ─── Escenario A: listar properties (25%) ──────────────────────────────────
function listProperties() {
  group('List Properties', () => {
    const res = http.get(`${BASE_URL}/api/hotel/properties`, {
      headers,
      tags: { endpoint: 'list_properties' },
    });

    const httpSuccess = check(res, {
      'list properties: status is 200': (r) => r.status === 200,
    });

    listPropertiesTrend.add(res.timings.duration);
    errorRate.add(!httpSuccess);
  });
}

// ─── Escenario B: listar room types (25%) ──────────────────────────────────
function listRoomTypes() {
  group('List Room Types', () => {
    const res = http.get(`${BASE_URL}/api/hotel/room-types`, {
      headers,
      tags: { endpoint: 'list_room_types' },
    });

    const httpSuccess = check(res, {
      'list room types: status is 200': (r) => r.status === 200,
    });

    listRoomTypesTrend.add(res.timings.duration);
    errorRate.add(!httpSuccess);
  });
}

// ─── Escenario C: listar bookings, con y sin filtro de status (30%) ───────
function listBookings() {
  group('List Bookings', () => {
    const status = randomItem(testData.statusFilters);
    const url = status
      ? `${BASE_URL}/api/hotel/bookings?status=${status}`
      : `${BASE_URL}/api/hotel/bookings`;

    const res = http.get(url, {
      headers,
      tags: { endpoint: 'list_bookings' },
    });

    const httpSuccess = check(res, {
      'list bookings: status is 200': (r) => r.status === 200,
    });

    listBookingsTrend.add(res.timings.duration);
    errorRate.add(!httpSuccess);
  });
}

// ─── Escenario D: consultar disponibilidad (20%) ──────────────────────────
// Requiere property_id + room_type_id reales, capturados en setup() y
// recibidos en `data`. Preferimos combinaciones coherentes (un room type
// que sí pertenece a la property consultada) vía roomTypesByProperty; si
// alguna property no tuviera room types mapeados (por si el campo
// property_id del room type resultara tener otro nombre), caemos a un
// room_type_id cualquiera del pool general como red de seguridad.
function checkAvailability(data) {
  group('Check Availability', () => {
    const propertiesWithRoomTypes = Object.keys(data.roomTypesByProperty);

    let propertyId, roomTypeId;
    if (propertiesWithRoomTypes.length > 0) {
      propertyId = randomItem(propertiesWithRoomTypes);
      roomTypeId = randomItem(data.roomTypesByProperty[propertyId]);
    } else {
      propertyId = randomItem(data.propertyIds);
      roomTypeId = randomItem(data.roomTypeIds);
    }

    const range = randomItem(testData.availabilityDateOffsets);
    const checkIn = dateFromOffset(range.checkInOffsetDays);
    const checkOut = dateFromOffset(range.checkOutOffsetDays);

    // ⚠️ Nombres de parámetro CORREGIDOS respecto a HOTEL_APP_CONTEXT.md
    // §6.4: check_in_date / check_out_date (no check_in / check_out), y
    // room_type_id añadido (exigido por el servidor pero ausente del
    // Swagger documentado).
    const url =
      `${BASE_URL}/api/hotel/availability` +
      `?property_id=${propertyId}&room_type_id=${roomTypeId}` +
      `&check_in_date=${checkIn}&check_out_date=${checkOut}`;

    const res = http.get(url, {
      headers,
      tags: { endpoint: 'check_availability' },
    });

    const httpSuccess = check(res, {
      'check availability: status is 200': (r) => r.status === 200,
    });

    // Log de diagnóstico muestreado (1%): con 500 VUs y miles de fallos
    // posibles, loguear el 100% inundaría la consola. Con ~1% ya sacamos
    // decenas de muestras suficientes para ver la causa real si vuelve a
    // fallar por algo nuevo.
    if (!httpSuccess && Math.random() < 0.01) {
      console.error(
        `check availability falló — status ${res.status}, url: ${url}, body: ${res.body}`
      );
    }

    checkAvailabilityTrend.add(res.timings.duration);
    errorRate.add(!httpSuccess);
  });
}

// ─── Función principal: K6 la ejecuta en bucle por cada VU ────────────────
// Recibe `data`, el valor devuelto por setup()
// (propertyIds, roomTypeIds, roomTypesByProperty).
export default function (data) {
  const roll = Math.random();

  if (roll < 0.25) {
    listProperties();
  } else if (roll < 0.50) {
    listRoomTypes();
  } else if (roll < 0.80) {
    listBookings();
  } else {
    checkAvailability(data);
  }

  // Think time: entre 1 y 3 segundos, igual que market-load.js
  sleep(Math.random() * 2 + 1);
}