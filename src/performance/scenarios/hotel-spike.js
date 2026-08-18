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
 * ⚠️ SUPUESTO SIN VERIFICAR TODAVÍA: el shape exacto del body de
 * respuesta (¿array plano o { properties: [...] }?) — Swagger UI no
 * mostró el "Example Value" en lo compartido. El helper extractArray()
 * de abajo soporta ambos casos como red de seguridad, pero confírmalo
 * en tu primera ejecución en local (ver instrucciones más abajo) y
 * ajusta si hace falta.
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

// Soporta tanto un array plano como un objeto envoltorio ({ properties: [...] },
// { data: [...] }, etc.) hasta que se confirme el shape real contra Swagger.
function extractArray(body, wrapperKey) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body[wrapperKey])) return body[wrapperKey];
  if (body && Array.isArray(body.data)) return body.data;
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
  const resetRes = http.post(`${BASE_URL}/api/hotel/reset`, null, { headers });
  check(resetRes, {
    'setup: reset status is 200': (r) => r.status === 200,
  });

  const propsRes = http.get(`${BASE_URL}/api/hotel/properties`, { headers });
  check(propsRes, {
    'setup: properties status is 200': (r) => r.status === 200,
  });

  const properties = extractArray(propsRes.json(), 'properties');
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

  return { propertyIds };
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
// Requiere un property_id real, capturado en setup() y recibido como
// parámetro `data` en la función principal.
function checkAvailability(propertyIds) {
  group('Check Availability', () => {
    const propertyId = randomItem(propertyIds);
    const range = randomItem(testData.availabilityDateOffsets);
    const checkIn = dateFromOffset(range.checkInOffsetDays);
    const checkOut = dateFromOffset(range.checkOutOffsetDays);

    // ⚠️ Nombres de parámetro CORREGIDOS: el Swagger real usa
    // check_in_date / check_out_date, no check_in / check_out como
    // documentaba (incorrectamente) HOTEL_APP_CONTEXT.md §6.4.
    const url =
      `${BASE_URL}/api/hotel/availability` +
      `?property_id=${propertyId}&check_in_date=${checkIn}&check_out_date=${checkOut}`;

    const res = http.get(url, {
      headers,
      tags: { endpoint: 'check_availability' },
    });

    const httpSuccess = check(res, {
      'check availability: status is 200': (r) => r.status === 200,
    });

    checkAvailabilityTrend.add(res.timings.duration);
    errorRate.add(!httpSuccess);
  });
}

// ─── Función principal: K6 la ejecuta en bucle por cada VU ────────────────
// Recibe `data`, el valor devuelto por setup() (aquí, { propertyIds }).
export default function (data) {
  const roll = Math.random();

  if (roll < 0.25) {
    listProperties();
  } else if (roll < 0.50) {
    listRoomTypes();
  } else if (roll < 0.80) {
    listBookings();
  } else {
    checkAvailability(data.propertyIds);
  }

  // Think time: entre 1 y 3 segundos, igual que market-load.js
  sleep(Math.random() * 2 + 1);
}
