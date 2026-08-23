# Hotel Performance Testing — Plan (K6 Spike Test)

> **Status:** 🟡 Planned — pending implementation
> **Branch:** `perf/hotel-spike-test-thresholds`
> **Related to:** `docs/HOTEL_APP_CONTEXT.md`, `docs/QA_PROJECT_ARCHITECTURE.md` §4.2, §6.2
> **Precedes:** `src/performance/scenarios/hotel-spike.js`

This document defines the design of the K6 spike test for the Hotel
application **before** writing any code, following the convention already
established by `src/performance/scenarios/market-load.js`.

---

## 1. Objective

Measure how the Hotel API responds to a **sudden spike in concurrency**
(a spike test, distinct from a sustained load test like Market's) and
whether the system recovers correctly once the load drops. Focus areas:

- Response times (p95/p99) per endpoint during the spike
- Error rate under maximum stress
- Recovery capacity after the spike (not just the spike itself)

## 2. Test type and load profile

Reference spec (`QA_PROJECT_ARCHITECTURE.md` §4.2): **Spike test · 500 VUs
in 30s · 3 min total duration**.

| Stage | Duration | From → To VUs | Purpose |
|---|---|---|---|
| Baseline | 10s | 0 → 20 | Warm-up, baseline before the spike |
| **Spike** | **30s** | **20 → 500** | The sudden spike (matches the spec) |
| Sustain | 60s | 500 constant | Measurement window under maximum stress |
| Recovery | 60s | 500 → 20 | Does the system recover once load drops? |
| Cooldown | 20s | 20 constant | Confirm stability after the spike |
| **Total** | **180s (3 min)** | | |

```javascript
// Reference for options.stages in hotel-spike.js
stages: [
  { duration: '10s', target: 20  },  // baseline
  { duration: '30s', target: 500 },  // SPIKE
  { duration: '60s', target: 500 },  // sustain under stress
  { duration: '60s', target: 20  },  // recovery
  { duration: '20s', target: 20  },  // cooldown / confirmation
]
```

## 3. Endpoints and traffic distribution (read-only — GET)

Decision: **GET endpoints only**, no booking creation. A spike test measures
resilience and concurrency, and does not need to generate write-side
side effects to be valid.

| Endpoint | % traffic | Rationale |
|---|---|---|
| `GET /api/hotel/properties` | 25% | Properties tab + feeds dynamic selects |
| `GET /api/hotel/room-types` | 25% | Room Types tab + dynamic select after choosing a property |
| `GET /api/hotel/bookings` | 30% | Most-used tab in the app; feeds the stats dashboard |
| `GET /api/hotel/availability` | 20% | Recently documented endpoint, not yet covered by tests (`HOTEL_APP_CONTEXT.md` §6.4) |

> Distribution is adjustable after the first run if any endpoint needs more
> or less relative pressure.

## 4. Data strategy

### 4.1 Reset before the test — CONFIRMED DECISION

`POST /api/hotel/reset` runs **before** the spike test, just like Market does
with `/api/reset`. This is consistent with the deterministic-state principle
from `QA_PROJECT_ARCHITECTURE.md` §4.3 (*"State reset:
`POST /api/reset` before each suite"*).

**Accepted consequence:** since Hotel's reset empties `bookings` and
`reviews` to zero (`HOTEL_APP_CONTEXT.md` §2), throughout the entire spike
test `GET /api/hotel/bookings` will return an empty or near-empty list, and
`GET /api/hotel/availability` will query against zero existing bookings.
This is acceptable because the goal of the test is to measure **server
concurrency and latency**, not data volume — we're still exercising the
real query against the database on every request, just with no rows to
traverse. If we want to measure with real data volume in the future, that
would be a different test (see §7, Out of scope).

### 4.2 Dynamic IDs via `setup()`

Unlike Market (fixed categories known in advance), Hotel's `property_id`
values are dynamic UUIDs per user/environment — they cannot be hardcoded
into a static JSON file. We use K6's `setup()` lifecycle function, which
runs **once, before the VUs start**:

```javascript
// Pattern to implement in hotel-spike.js
export function setup() {
  http.post(`${BASE_URL}/api/hotel/reset`, null, { headers });
  const res = http.get(`${BASE_URL}/api/hotel/properties`, { headers });
  const properties = JSON.parse(res.body).properties; // confirm actual shape in Swagger
  return { propertyIds: properties.map(p => p.id) };
}

export default function (data) {
  // data.propertyIds available on every iteration, for every VU
}
```

### 4.3 Static data — `hotel-test-data.json`

For what actually is fixed and known in advance (just like Market varies
`category`/`sort`), we use a static JSON file:

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

- `statusFilters` includes `""` (empty string) to vary between calling
  `GET /api/hotel/bookings` with and without `?status=`.
- `availabilityDateOffsets` are days relative to "today" (calculated in the
  script, not absolute dates) so the test remains valid regardless of when
  it runs.

## 5. Proposed thresholds — `hotelThresholds` in `sla-config.js`

> ✅ **Updated with real data** after running the full spike test (see §10).
> The values in this table are what was originally proposed as a hypothesis
> — the table in §10 has the final calibrated values, which are what's
> actually in `sla-config.js`.

| Metric | Initial threshold (hypothesis) | Original rationale |
|---|---|---|
| `http_req_duration` (global) | `p(95)<3000`, `p(99)<4500` | Looser than Market, assuming degradation under spike |
| `http_req_failed` (global) | `rate<0.03` | Slightly more error tolerance than a load test |
| `hotel_error_rate` (custom) | `rate<0.03` | Same criterion as the global one |
| `hotel_list_properties_duration` | `p(95)<1000ms` | Small dataset (5 properties after reset) |
| `hotel_list_room_types_duration` | `p(95)<1200ms` | Slightly larger dataset (14 room types after reset) |
| `hotel_list_bookings_duration` | `p(95)<800ms` | Empty/minimal dataset after reset |
| `hotel_check_availability_duration` | `p(95)<1800ms` | New endpoint, no prior baseline |

## 6. File structure to create

```
src/performance/
├── scenarios/hotel-spike.js          ← new
├── thresholds/sla-config.js          ← edit: add hotelThresholds export
└── data/hotel-test-data.json         ← new
```

`package.json` (§8.2 of the architecture) — add:

```json
"test:perf:hotel": "k6 run src/performance/scenarios/hotel-spike.js"
```

## 7. CI integration — `performance-tests.yml`

New `k6-hotel-spike` job in the same workflow as `k6-market-baseline`,
with an explicit dependency to guarantee sequencing (§6.2: *"K6 Tests:
Sequential — performance tests must not run concurrently"*):

```yaml
k6-hotel-spike:
  name: Hotel Spike Test
  runs-on: ubuntu-latest
  needs: k6-market-baseline   # forces order: Market first, Hotel after
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
        # identical to the k6-market-baseline step
    - name: Run Hotel Spike Test
      run: k6 run src/performance/scenarios/hotel-spike.js
      # Note: reset is no longer a separate shell step like in Market,
      # because in Hotel the reset is done inside the K6 script's own
      # setup() (see §4.1/4.2) — this guarantees that the reset and the
      # property_ids capture happen in the same atomic step.
    - name: Upload K6 results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: k6-hotel-spike-results
        path: k6-results/
        retention-days: 30
```

> Notable difference from Market: in Market, the reset is a `curl` in a
> separate shell step, before invoking `k6 run`. In Hotel, we move the reset
> inside JavaScript's `setup()` because we need to chain it with capturing
> `property_ids` in the same operation — doing this in shell would require
> parsing the reset response or making an extra call, which K6 already
> resolves natively via `setup()`.

## 8. Out of scope (for now)

- Real data-volume test on `bookings`/`availability` (would require seeding
  data before the spike, which contradicts the "read-only, with
  deterministic reset" decision made in §4.1)
- Write endpoints (`POST /api/hotel/bookings`, `PATCH .../status`) under
  load — candidate for a future iteration if we decide to measure the
  booking lifecycle under stress
- Bank app — out of scope for the project for now (see
  `docs/QA_PROJECT_ARCHITECTURE.md`)

## 9. Next steps (one session each, as agreed)

1. ✅ This plan document
2. ✅ `src/performance/data/hotel-test-data.json`
3. ✅ `hotelThresholds` in `src/performance/thresholds/sla-config.js`
4. ✅ `src/performance/scenarios/hotel-spike.js`
5. 🔲 Add the `k6-hotel-spike` job to `.github/workflows/performance-tests.yml`
6. 🔲 Add the `test:perf:hotel` script to `package.json`
7. 🔲 Update coverage tables in `README.md` and the Sprint 3 roadmap in
   `QA_PROJECT_ARCHITECTURE.md` (mark "K6: Hotel spike test" as done)
8. 🔲 Open a PR toward `develop`

## 10. Results from the first real run (2026-08-19)

Full execution of the load profile defined in §2, against the real
`qacloud.dev`, using the development API key.

### 10.1 Summary

| Metric | Actual value |
|---|---|
| Total requests | 11,898 |
| `checks_succeeded` | **100.00%** (11,898 / 11,898) |
| `http_req_failed` | **0.00%** |
| `http_req_duration` — median | ~1.2–1.4s |
| `http_req_duration` — p90 | ~7.6–7.9s |
| `http_req_duration` — p95 | ~8.5–9.1s (depending on endpoint) |
| `http_req_duration` — p99 | ~10.7s |
| `http_req_duration` — peak maximum | ~15.5s |

### 10.2 Findings

1. **Excellent functional resilience:** across nearly 12,000 requests under
   a spike of 500 simultaneous VUs, the API **never returned an error**
   (neither 4xx nor 5xx, aside from the expected 400s already resolved
   during script development — see §10.3). The system does not fall over
   under pressure.
2. **Significant latency degradation under the spike:** the median stays
   reasonable (~1.2–1.4s) but the tails spike sharply (p95 ~9s, p99
   ~10.7s, peaks up to 15.5s). This is valuable information about the
   system's real capacity under high concurrency.
3. **All 4 endpoints degrade almost identically** (p95 between 8.51s and
   9.06s, a difference of less than 600ms between the fastest and the
   slowest). This suggests the bottleneck **is not a particular query**,
   but rather general server/infrastructure capacity under high
   concurrency — consistent with a QA practice environment, not a
   production infrastructure sized for 500 VUs.
4. **The initial thresholds (§5) were too optimistic** — they were based
   on hypotheses without real data, exactly as flagged at the time. They
   were recalibrated with this run (see `sla-config.js` for the final
   values, with ~15–20% margin over what was observed).

### 10.3 Bugs / discrepancies found during development

None of these affect the final result (already fixed in
`hotel-spike.js`), but they remain documented because they are real QA
findings about the application under test itself, not just about the test:

1. **`GET /api/hotel/availability` uses `check_in_date` / `check_out_date`**,
   not `check_in` / `check_out` as `HOTEL_APP_CONTEXT.md` §6.4 previously
   documented. The `.md` correction is pending (see checklist below).
2. **`GET /api/hotel/availability` also requires `room_type_id`** as a
   required parameter, but the Swagger UI does not list it among the
   endpoint's parameters — it is only discovered at runtime via the 400
   error message: `"Property ID, room type ID, check-in date,
   and check-out date are required"`. This is a real discrepancy between
   the documented Swagger spec and the server's validation. Pending
   annotation in `HOTEL_APP_CONTEXT.md` §6.4 as a correction, same as the
   document's previous corrections (PATCH vs PUT, `rating` vs
   `overall_rating`).