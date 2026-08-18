# Hotel Performance Testing — Plan (K6 Spike Test)

> **Estado:** 🟡 Planificado — pendiente de implementación
> **Rama:** `perf/hotel-spike-test-thresholds`
> **Relacionado con:** `docs/HOTEL_APP_CONTEXT.md`, `docs/QA_PROJECT_ARCHITECTURE.md` §4.2, §6.2
> **Precede a:** `src/performance/scenarios/hotel-spike.js`

Este documento define el diseño del spike test de K6 para la aplicación Hotel
**antes** de escribir ningún código, siguiendo la convención ya establecida
por `src/performance/scenarios/market-load.js`.

---

## 1. Objetivo

Medir cómo responde la Hotel API a un **pico brusco de concurrencia** (spike
test, distinto de un load test sostenido como el de Market) y si el sistema
se recupera correctamente cuando la carga baja. Foco en:

- Tiempos de respuesta (p95/p99) por endpoint durante el pico
- Tasa de error bajo estrés máximo
- Capacidad de recuperación tras el pico (no solo el pico en sí)

## 2. Tipo de test y perfil de carga

Spec de referencia (`QA_PROJECT_ARCHITECTURE.md` §4.2): **Spike test · 500 VUs
en 30s · 3 min de duración total**.

| Etapa | Duración | De → A VUs | Propósito |
|---|---|---|---|
| Baseline | 10s | 0 → 20 | Calentamiento, línea base antes del pico |
| **Spike** | **30s** | **20 → 500** | El pico brusco (coincide con la spec) |
| Sustain | 60s | 500 constantes | Ventana de medición bajo estrés máximo |
| Recovery | 60s | 500 → 20 | ¿Se recupera el sistema al bajar la carga? |
| Cooldown | 20s | 20 constantes | Confirmar estabilidad tras el pico |
| **Total** | **180s (3 min)** | | |

```javascript
// Referencia para options.stages en hotel-spike.js
stages: [
  { duration: '10s', target: 20  },  // baseline
  { duration: '30s', target: 500 },  // SPIKE
  { duration: '60s', target: 500 },  // sustain bajo estrés
  { duration: '60s', target: 20  },  // recovery
  { duration: '20s', target: 20  },  // cooldown / confirmación
]
```

## 3. Endpoints y distribución de tráfico (solo lectura — GET)

Decisión: **solo endpoints GET**, sin creación de bookings. Un spike test
mide resiliencia y concurrencia, no necesita generar efectos secundarios de
escritura para ser válido.

| Endpoint | % tráfico | Justificación |
|---|---|---|
| `GET /api/hotel/properties` | 25% | Tab Properties + alimenta selects dinámicos |
| `GET /api/hotel/room-types` | 25% | Tab Room Types + select dinámico tras elegir property |
| `GET /api/hotel/bookings` | 30% | Tab más usada de la app; alimenta el stats dashboard |
| `GET /api/hotel/availability` | 20% | Endpoint documentado recientemente, sin cobertura de tests aún (`HOTEL_APP_CONTEXT.md` §6.4) |

> Repartos ajustables tras la primera ejecución si algún endpoint necesita
> más o menos presión relativa.

## 4. Estrategia de datos

### 4.1 Reset antes del test — DECISIÓN CONFIRMADA

`POST /api/hotel/reset` se ejecuta **antes** del spike test, igual que hace
Market con `/api/reset`. Esto es coherente con el principio de estado
determinista de `QA_PROJECT_ARCHITECTURE.md` §4.3 ("State reset:
`POST /api/reset` before each suite").

**Consecuencia aceptada:** como el reset de Hotel vacía `bookings` y
`reviews` a cero (`HOTEL_APP_CONTEXT.md` §2), durante todo el spike test
`GET /api/hotel/bookings` devolverá una lista vacía o casi vacía, y
`GET /api/hotel/availability` consultará sobre cero reservas existentes.
Esto es aceptable porque el objetivo del test es medir **concurrencia y
latencia del servidor**, no volumen de datos — seguimos ejercitando la
query real contra la base de datos en cada request, solo que sin filas que
recorrer. Si en el futuro queremos medir con volumen de datos real, sería
un test distinto (ver §7, Fuera de alcance).

### 4.2 IDs dinámicos vía `setup()`

A diferencia de Market (categorías fijas conocidas de antemano), los
`property_id` de Hotel son UUIDs dinámicos por usuario/entorno — no se
pueden hardcodear en un JSON estático. Usamos la función de ciclo de vida
`setup()` de K6, que corre **una sola vez antes de que arranquen los VUs**:

```javascript
// Patrón a implementar en hotel-spike.js
export function setup() {
  http.post(`${BASE_URL}/api/hotel/reset`, null, { headers });
  const res = http.get(`${BASE_URL}/api/hotel/properties`, { headers });
  const properties = JSON.parse(res.body).properties; // confirmar shape real en Swagger
  return { propertyIds: properties.map(p => p.id) };
}

export default function (data) {
  // data.propertyIds disponible en cada iteración, de cada VU
}
```

### 4.3 Datos estáticos — `hotel-test-data.json`

Para lo que sí es fijo y conocido de antemano (igual que Market varía
`category`/`sort`), usamos un JSON estático:

```json
{
  "statusFilters": ["", "PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"],
  "availabilityDateOffsets": [
    { "checkInOffsetDays": 3,  "checkOutOffsetDays": 5  },
    { "checkInOffsetDays": 7,  "checkOutOffsetDays": 9  },
    { "checkInOffsetDays": 14, "checkOutOffsetDays": 16 },
    { "checkInOffsetDays": 30, "checkOutOffsetDays": 33 }
  ]
}
```

- `statusFilters` incluye `""` (string vacío) para variar entre llamar a
  `GET /api/hotel/bookings` con y sin `?status=`.
- `availabilityDateOffsets` son días relativos a "hoy" (calculados en el
  script, no fechas absolutas) para que el test siga siendo válido sin
  importar cuándo se ejecute.

## 5. Thresholds propuestos — `hotelThresholds` en `sla-config.js`

> ⚠️ Valores **iniciales/hipótesis**, no medidos aún. Práctica recomendada:
> primera ejecución con thresholds permisivos (o en modo observación) para
> capturar una baseline real, y ajustar después — igual que se validó
> `marketThresholds` en su momento.

| Métrica | Umbral propuesto | Razonamiento |
|---|---|---|
| `http_req_duration` (global) | `p(95)<3000`, `p(99)<4500` | Más laxo que Market (2000/3000) porque un spike test asume degradación bajo pico |
| `http_req_failed` (global) | `rate<0.03` | Se tolera algo más de error que en load test (Market: <0.01), pero no deriva |
| `hotel_error_rate` (custom, checks) | `rate<0.03` | Igual criterio que el global |
| `hotel_list_properties_duration` | `p(95)<1000ms` | Dataset pequeño (5 properties tras reset) |
| `hotel_list_room_types_duration` | `p(95)<1200ms` | Dataset algo mayor (14 room types tras reset) |
| `hotel_list_bookings_duration` | `p(95)<800ms` | Dataset vacío/mínimo tras reset — debería ser muy rápido |
| `hotel_check_availability_duration` | `p(95)<1800ms` | Endpoint más nuevo, con lógica de cálculo de fechas, sin baseline previa |

## 6. Estructura de archivos a crear

```
src/performance/
├── scenarios/hotel-spike.js          ← nuevo
├── thresholds/sla-config.js          ← editar: añadir export hotelThresholds
└── data/hotel-test-data.json         ← nuevo
```

`package.json` (§8.2 de la arquitectura) — añadir:

```json
"test:perf:hotel": "k6 run src/performance/scenarios/hotel-spike.js"
```

## 7. Integración CI — `performance-tests.yml`

Nuevo job `k6-hotel-spike` en el mismo workflow que `k6-market-baseline`,
con dependencia explícita para garantizar secuencialidad (§6.2: *"K6 Tests:
Sequential — performance tests must not run concurrently"*):

```yaml
k6-hotel-spike:
  name: Hotel Spike Test
  runs-on: ubuntu-latest
  needs: k6-market-baseline   # fuerza orden: Market primero, Hotel después
  env:
    QACLOUD_BASE_URL: ${{ secrets.QACLOUD_BASE_URL }}
    QACLOUD_API_KEY:  ${{ secrets.QACLOUD_API_KEY }}
  steps:
    - name: Checkout
      uses: actions/checkout@v4
      with:
        ref: ${{ github.event.workflow_run.head_sha || github.sha }}
    - name: Install K6
      run: |
        # idéntico al paso de k6-market-baseline
    - name: Run Hotel Spike Test
      run: k6 run src/performance/scenarios/hotel-spike.js
      # Nota: el reset ya NO va como paso de shell separado como en Market,
      # porque en Hotel el reset se hace dentro de setup() en el propio
      # script K6 (ver §4.1/4.2) — así garantizamos que el reset y la
      # captura de property_ids ocurren en el mismo paso atómico.
    - name: Upload K6 results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: k6-hotel-spike-results
        path: k6-results/
        retention-days: 30
```

> Diferencia notable respecto a Market: en Market el reset es un `curl` en
> un step de shell separado, antes de invocar `k6 run`. En Hotel movemos el
> reset dentro de `setup()` en JavaScript porque necesitamos encadenarlo con
> la captura de `property_ids` en la misma operación — hacerlo en shell
> requeriría parsear la respuesta del reset o hacer una llamada extra, lo
> cual K6 ya resuelve de forma nativa con `setup()`.

## 8. Fuera de alcance (por ahora)

- Test de volumen de datos real en `bookings`/`availability` (requeriría
  sembrar datos antes del spike, lo cual contradice la decisión de "solo
  lectura, con reset determinista" tomada en §4.1)
- Endpoints de escritura (`POST /api/hotel/bookings`, `PATCH .../status`)
  bajo carga — candidato para una iteración futura si se decide medir el
  ciclo de vida de reservas bajo estrés
- Bank app — fuera de alcance del proyecto por ahora (ver
  `docs/QA_PROJECT_ARCHITECTURE.md`)

## 9. Próximos pasos (una sesión cada uno, según lo acordado)

1. ✅ Este documento de plan
2. 🔲 Crear `src/performance/data/hotel-test-data.json`
3. 🔲 Añadir `hotelThresholds` a `src/performance/thresholds/sla-config.js`
4. 🔲 Escribir `src/performance/scenarios/hotel-spike.js`
5. 🔲 Añadir job `k6-hotel-spike` a `.github/workflows/performance-tests.yml`
6. 🔲 Añadir script `test:perf:hotel` a `package.json`
7. 🔲 Actualizar tablas de cobertura en `README.md` y roadmap Sprint 3 en
   `QA_PROJECT_ARCHITECTURE.md` (marcar "K6: Hotel spike test" como hecho)
8. 🔲 Abrir PR hacia `develop`
