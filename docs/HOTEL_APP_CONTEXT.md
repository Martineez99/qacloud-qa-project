# Hotel App — QA Context

> **App URL:** `https://www.qacloud.dev/hotel.html`
> **Swagger UI:** `https://www.qacloud.dev/hotel/docs`

This document covers everything a QA engineer needs to understand and test the Hotel application: domain logic, API reference, UI behavior, and test case catalogue.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Key QA Characteristics](#2-key-qa-characteristics)
3. [Seed Data](#3-seed-data)
4. [UI Overview](#4-ui-overview)
5. [Application Flows](#5-application-flows)
6. [API Reference](#6-api-reference)
7. [Test Cases — E2E](#7-test-cases--e2e)
8. [Test Cases — API](#8-test-cases--api)

---

## 1. Application Overview

The **Hotel Application** simulates a hotel management system. It allows creating properties, defining room types per property, managing the full booking lifecycle, and collecting guest reviews.

Each user gets their own **fully isolated data environment**, pre-seeded with properties and room types. Data never leaks between users, making it safe to run destructive tests.

### Data Architecture

```
User (api_key)
 ├── Properties     (hotels — seed data restored on reset)
 │     └── Room Types  (belong to a Property — seed data restored on reset)
 ├── Bookings       (belong to a Property + Room Type — wiped on reset)
 └── Reviews        (belong to a Property via a CHECKED_OUT Booking — wiped on reset)
```

> ✅ `POST /api/hotel/reset` resets **all hotel data** for the authenticated user:
> Properties and Room Types are restored to seed state, and Bookings and Reviews
> are wiped completely (the user starts with zero bookings/reviews after a reset).
>
> *Confirmed against the live Swagger description ("Reset all hotel data for the
> authenticated user") — this corrects an earlier assumption in this document that
> reset only touched Properties and Room Types.*

---

## 2. Key QA Characteristics

| Feature | Behavior | QA Relevance |
|---------|----------|--------------|
| **Booking lifecycle** | Status transitions: PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT → CANCELLED / NO_SHOW | State machine testing |
| **Cancellation reason** | Required field when status is set to CANCELLED | Conditional validation |
| **Reviews gated by status** | A booking is only eligible for review when status is CHECKED_OUT | Precondition testing |
| **Dynamic Room Type select** | Room Type dropdown populates via JS after selecting a Property | Async UI interaction |
| **Stats dashboard** | Total Bookings, Pending, Confirmed, Checked In, Total Revenue update in real time | Counter validation |
| **Confirmation number format** | `HB` + date (YYYYMMDD) + `-` + 6 random alphanumeric chars (e.g. `HB20260611-YW2HVP`) | Regex validation |
| **Data isolation** | Using another user's API key returns empty data | Security testing |
| **Reset endpoint** | `POST /api/hotel/reset` resets **all** hotel data — Properties/Room Types restored to seed, Bookings/Reviews wiped to zero | Full deterministic test setup, no manual cleanup needed |
| **Cascade on property delete** | Deleting a Property removes its Room Types | Referential integrity |

---

## 3. Seed Data

On registration (and after every reset), each user receives the following pre-seeded data:

### Properties (5)

| Name | City | Country | Stars |
|------|------|---------|-------|
| Grand Plaza Hotel | New York | USA | ⭐⭐⭐⭐⭐ |
| Seaside Resort | Miami | USA | ⭐⭐⭐⭐ |
| Mountain View Lodge | Denver | USA | ⭐⭐⭐ |
| Downtown Budget Inn | Chicago | USA | ⭐⭐ |
| Boutique Garden Hotel | San Francisco | USA | ⭐⭐⭐⭐ |

### Room Types (14 — distributed across properties)

| Property | Room Type | Bed | Max Occ. | Price/Night | Rooms |
|----------|-----------|-----|----------|-------------|-------|
| Downtown Budget Inn | Standard Queen Room | Queen | 2 | $85.00 | 40 |
| Downtown Budget Inn | Economy Double Room | Double | 4 | $95.00 | 30 |
| Mountain View Lodge | Budget Twin Room | Twin | 2 | $120.00 | 15 |
| Boutique Garden Hotel | Cozy Single | Single | 1 | $150.00 | 8 |
| Mountain View Lodge | Mountain View Room | Queen | 2 | $180.00 | 20 |
| Grand Plaza Hotel | Standard Double Room | Double | 4 | $220.00 | 30 |
| Boutique Garden Hotel | Artisan Room | Queen | 2 | $220.00 | 12 |
| Seaside Resort | Garden View Room | Queen | 2 | $250.00 | 25 |
| Grand Plaza Hotel | Deluxe King Room | King | 2 | $280.00 | 20 |
| Boutique Garden Hotel | Garden Suite | King | 2 | $320.00 | 6 |
| Mountain View Lodge | Alpine Chalet | King | 5 | $380.00 | 8 |
| Seaside Resort | Ocean View Suite | King | 3 | $420.00 | 15 |
| Grand Plaza Hotel | Executive Suite | King | 3 | $450.00 | 10 |
| Seaside Resort | Beachfront Villa | King | 4 | $850.00 | 5 |

**Valid bed types:** `Single` · `Double` · `Queen` · `King` · `Twin`

---

## 4. UI Overview

The application lives at `/hotel.html` and has **4 tabs** plus modals for specific actions.

### Tab: Properties

- **Form (top):** Add New Property — required fields: Name, City, Country, Address. Optional: Star Rating, Postal Code, Phone, Email, Check-in/out times, Description, Cancellation Policy.
- **Table (bottom):** My Properties — columns: Name, City, Country, Rating, Status, Actions (Delete).
- No edit button — delete only.

### Tab: Room Types

- **Form (top):** Add Room Type — requires selecting a Property first (dynamic select populated from existing properties). Required: Property, Name, Bed Type, Max Occupancy, Price/Night, Total Rooms.
- **Table (bottom):** All room types across all properties — columns: Property, Room Type, Bed Type, Max Occupancy, Price/Night, Total Rooms, Status, Actions (Delete).

### Tab: Bookings

- **Stats dashboard (top):** Total Bookings · Pending · Confirmed · Checked In · Total Revenue.
- **Form:** Create New Booking — Property select triggers dynamic load of Room Types. Required: Property, Room Type, Guest Name, Email, Phone, Check-in Date, Check-out Date, Num Guests, Num Rooms (default 1).
- **Filter:** Filter by Status dropdown (All, PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW).
- **Table:** All Bookings — columns: Confirmation #, Guest, Property, Room Type, Check-in, Check-out, Guests, Total Amount, Status, Actions (Update / Delete).
- **Update modal:** Select new status + optional Cancellation Reason (visible only when CANCELLED is selected).

### Tab: Reviews

- **Table:** Guest Reviews — columns: Guest, Property, Rating, Comment, Date.
- **Add Review button:** Opens modal — select a CHECKED_OUT booking → form appears → star ratings (Overall + Cleanliness, Service, Location, Value) + optional comment.

### Booking Status Badges

| Status | Badge colour |
|--------|-------------|
| PENDING | Yellow |
| CONFIRMED | Blue |
| CHECKED_IN | Green |
| CHECKED_OUT | Grey |
| CANCELLED | Red |
| NO_SHOW | Orange |

### Confirmation Number Format

```
HB + YYYYMMDD + - + 6 alphanumeric chars
Example: HB20260611-YW2HVP
Regex:   /^HB\d{8}-[A-Z0-9]{6}$/
```

---

## 5. Application Flows

### 5.1 Properties Flow

```
1. POST /api/hotel/reset              → Deterministic state: 5 seed properties + 14 room types
                                        restored; all bookings and reviews wiped to zero
2. GET  /api/hotel/properties         → List all properties
3. GET  /api/hotel/properties/:id     → Get a single property
4. POST /api/hotel/properties         → Create property (required: name, city, country, address)
5. PUT  /api/hotel/properties/:id     → Update property (partial update)
6. DELETE /api/hotel/properties/:id   → Delete property (CASCADE removes its room types)
```

### 5.2 Room Types Flow

```
1. POST /api/hotel/room-types         → Create room type (required: property_id, name, bed_type,
                                        max_occupancy, price_per_night, total_rooms)
2. GET  /api/hotel/room-types         → List all room types
3. GET  /api/hotel/room-types/:id     → Get a single room type
4. PUT  /api/hotel/room-types/:id     → Update room type (partial update)
5. DELETE /api/hotel/room-types/:id   → Delete room type
```

### 5.3 Booking Lifecycle Flow

```
1. POST /api/hotel/bookings           → Create booking (required: property_id, room_type_id,
                                        guest_name, guest_email, guest_phone,
                                        check_in_date, check_out_date, number_of_guests)
2. GET  /api/hotel/bookings           → List all bookings (optional: ?status=PENDING)
3. GET  /api/hotel/bookings/:id       → Get specific booking
4. GET  /api/hotel/availability       → Check room availability (property_id, check_in, check_out)
5. PATCH /api/hotel/bookings/:id/status → Update status (and cancellation_reason when applicable)
   Valid transitions: PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT
                      Any status → CANCELLED (cancellation_reason is optional)
                      Any status → NO_SHOW
6. DELETE /api/hotel/bookings/:id     → Delete booking record
```

### 5.4 Reviews Flow

```
1. [Booking with status CHECKED_OUT]  → Required precondition
2. POST /api/hotel/reviews            → Create review (required: booking_id, property_id,
                                        rating 1-5)
3. GET  /api/hotel/reviews            → List all reviews
```

---

## 6. API Reference

> **Authentication:** all endpoints require `Authorization: qac_live_...`

### 6.1 Properties

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `GET` | `/api/hotel/properties` | List all properties | 200 |
| `GET` | `/api/hotel/properties/:id` | Get specific property | 200 |
| `POST` | `/api/hotel/properties` | Create property | 201 |
| `PUT` | `/api/hotel/properties/:id` | Update property (partial) | 200 |
| `DELETE` | `/api/hotel/properties/:id` | Delete property (cascade) | 200 |
| `POST` | `/api/hotel/reset` | Reset **all** hotel data to seed state (properties, room types, bookings, reviews) | 200 |

### 6.2 Room Types

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `GET` | `/api/hotel/room-types` | List all room types | 200 |
| `GET` | `/api/hotel/room-types/:id` | Get specific room type | 200 |
| `POST` | `/api/hotel/room-types` | Create room type | 201 |
| `PUT` | `/api/hotel/room-types/:id` | Update room type (partial) | 200 |
| `DELETE` | `/api/hotel/room-types/:id` | Delete room type | 200 |

### 6.3 Bookings

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `POST` | `/api/hotel/bookings` | Create booking | 201 |
| `GET` | `/api/hotel/bookings` | List all bookings (optional `?status=`) | 200 |
| `GET` | `/api/hotel/bookings/:id` | Get specific booking | 200 |
| `PATCH` | `/api/hotel/bookings/:id/status` | Update booking status (+ `cancellation_reason` when applicable and its optional) | 200 |
| `DELETE` | `/api/hotel/bookings/:id` | Delete booking | 200 |

> ⚠️ **Corrected:** status updates use `PATCH /api/hotel/bookings/:id/status`,
> **not** `PUT /api/hotel/bookings/:id` as earlier drafts of this document stated.
> Confirmed against the live Swagger UI at `/hotel/docs`.

**Request body — `POST /api/hotel/bookings`:**

```json
{
  "property_id":    "uuid",          // required
  "room_type_id":   "uuid",          // required
  "guest_name":     "John Doe",      // required
  "guest_email":    "john@mail.com", // required
  "guest_phone":    "+1234567890",   // required
  "check_in_date":  "2026-07-01",    // required — YYYY-MM-DD
  "check_out_date": "2026-07-03",    // required — YYYY-MM-DD
  "number_of_guests":     2,               // required
  "number_of_rooms":      1,               // optional — default 1
  "special_requests": "Late check-in" // optional
}
```

**Request body — `PATCH /api/hotel/bookings/:id/status`:**

```json
{
  "status": "CONFIRMED"              // required
}
```

```json
{
  "status": "CANCELLED",
  "cancellation_reason": "Guest request" // required when status = CANCELLED
}
```

### 6.4 Availability

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `GET` | `/api/hotel/availability` | Check room availability for a property and date range | 200 |

**Query params — `GET /api/hotel/availability`:**

property_id=uuid // required — string($uuid)
check_in_date=2026-07-01 // required — YYYY-MM-DD
check_out_date=2026-07-03 // required — YYYY-MM-DD


> ⚠️ **Corrected:** the query params are `check_in_date` and
> `check_out_date`, **not** `check_in` and `check_out` as earlier drafts
> of this document stated. Confirmed against the live Swagger UI at
> `/hotel/docs`. Response returns available room types with counts (200)
> or 400 on invalid dates — exact response body shape still to be
> confirmed once we write `TC-H-API` cases for it.

### 6.5 Reviews

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `POST` | `/api/hotel/reviews` | Create review | 201 |
| `GET` | `/api/hotel/reviews` | List all reviews | 200 |

**Request body — `POST /api/hotel/reviews`:**

```json
{
  "booking_id":          "uuid",  // required — must be CHECKED_OUT
  "property_id":         "uuid",  // required
  "rating":               5,      // required — 1 to 5
  "cleanliness_rating":  4,       // optional — 1 to 5
  "service_rating":      5,       // optional — 1 to 5
  "location_rating":     5,       // optional — 1 to 5
  "value_rating":        4,       // optional — 1 to 5
  "comment":             "Excellent stay!" // optional
}
```

> ⚠️ **Corrected:** the rating field is named `rating`, **not** `overall_rating`
> as earlier drafts of this document stated. Confirmed against the live Swagger
> schema. The UI section above (§4, Tab: Reviews) may still describe it to the
> user as "Overall Rating" — that's just the UI label, the API field is `rating`.

---

## 7. Test Cases — E2E

> Target: browser at `/hotel.html`. Auth via stored session (`platform.json`).
> `beforeAll`: `POST /api/hotel/reset` to guarantee seed state.
> Seed properties and room types are available after reset — no need to create them in tests.

### TC-H-E2E-001 — Full Booking Creation and Stats Update

| Field | Value |
|-------|-------|
| **Type** | Positive |
| **Priority** | P1 |
| **Tags** | `@hotel @e2e @booking @smoke` |
| **Precondition** | Reset done. Bookings table is empty. |

**Steps:**
1. Navigate to `/hotel.html` → tab Bookings
2. Note stats: Total Bookings = 0, Total Revenue = $0.00
3. Select property "Grand Plaza Hotel - New York"
4. Wait for Room Types to load → select "Standard Double Room"
5. Fill: Guest Name = "Test Guest", Email = "test@qa.com", Phone = "+1234567890"
6. Fill: Check-in = next Monday, Check-out = next Wednesday (2 nights)
7. Fill: Num Guests = 2, Num Rooms = 1
8. Click "Create Booking"

**Expected:**
- New row appears in the bookings table
- Confirmation number matches `/^HB\d{8}-[A-Z0-9]{6}$/`
- Status badge shows "PENDING"
- Total Amount = $440.00 (Standard Double Room $220/night × 2 nights × 1 room)
- Stats: Total Bookings = 1, Pending = 1, Total Revenue = $440.00

---

### TC-H-E2E-002 — Full Booking Lifecycle: PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT

| Field | Value |
|-------|-------|
| **Type** | Positive |
| **Priority** | P1 |
| **Tags** | `@hotel @e2e @booking @lifecycle` |
| **Precondition** | Reset done. One booking created (reuses TC-H-E2E-001 setup via API). |

**Steps:**
1. Navigate to tab Bookings
2. Locate the booking row by confirmation number
3. Click "Update" → select "CONFIRMED" → click "Update Status"
4. Verify badge = "CONFIRMED", Stats: Confirmed = 1, Pending = 0
5. Click "Update" → select "CHECKED_IN" → click "Update Status"
6. Verify badge = "CHECKED_IN", Stats: Checked In = 1, Confirmed = 0
7. Click "Update" → select "CHECKED_OUT" → click "Update Status"
8. Verify badge = "CHECKED_OUT"

**Expected:**
- Each status transition updates the badge immediately
- Stats dashboard reflects each transition accurately
- Final status is "CHECKED_OUT"

---

### TC-H-E2E-003 — Cancellation with Reason (conditional field validation)

| Field | Value |
|-------|-------|
| **Type** | Negative / Edge |
| **Priority** | P1 |
| **Tags** | `@hotel @e2e @booking @cancellation` |
| **Precondition** | Reset done. One booking in PENDING status. |

**Steps:**
1. Navigate to tab Bookings
2. Click "Update" on the PENDING booking
3. Select "CANCELLED" in the status dropdown
4. Verify that the "Cancellation Reason" textarea becomes visible
5. Attempt to click "Update Status" without filling the reason (if field is required)
6. Fill reason: "Guest requested cancellation"
7. Click "Update Status"

**Expected:**
- Cancellation Reason field appears only when CANCELLED is selected
- Status badge changes to "CANCELLED" (red)
- Stats: Pending = 0 (booking no longer counts as active)

---

### TC-H-E2E-004 — Review Creation After CHECKED_OUT

| Field | Value |
|-------|-------|
| **Type** | Positive |
| **Priority** | P1 |
| **Tags** | `@hotel @e2e @review @lifecycle` |
| **Precondition** | Reset done. One booking driven to CHECKED_OUT status via API (to avoid repeating lifecycle steps). |

**Steps:**
1. Navigate to tab Reviews
2. Verify reviews table is empty
3. Click "➕ Add Review"
4. Verify the booking appears in the dropdown (guest name + property + date)
5. Select the booking → verify review form section becomes visible
6. Set Overall Rating = 5 stars
7. Set Cleanliness = 4, Service = 5, Location = 5, Value = 4
8. Fill comment: "Excellent stay, would recommend!"
9. Click "Submit Review"

**Expected:**
- Review appears in the table with correct guest name, property, rating and comment
- Review count = 1

---

### TC-H-E2E-005 — Review Modal Only Shows CHECKED_OUT Bookings

| Field | Value |
|-------|-------|
| **Type** | Edge |
| **Priority** | P2 |
| **Tags** | `@hotel @e2e @review @edge` |
| **Precondition** | Reset done. Two bookings created via API: one PENDING, one CHECKED_OUT. |

**Steps:**
1. Navigate to tab Reviews
2. Click "➕ Add Review"
3. Inspect the dropdown options in "Select Booking to Review"

**Expected:**
- Only the CHECKED_OUT booking appears in the dropdown
- The PENDING booking does NOT appear
- Selecting the CHECKED_OUT booking reveals the review form

---

### TC-H-E2E-006 — Booking Delete Removes Row and Updates Stats

| Field | Value |
|-------|-------|
| **Type** | Positive |
| **Priority** | P2 |
| **Tags** | `@hotel @e2e @booking @delete` |
| **Precondition** | Reset done. One booking in PENDING status. |

**Steps:**
1. Navigate to tab Bookings
2. Note: Total Bookings = 1, Total Revenue = $X
3. Click "Delete" on the booking row
4. Confirm the deletion dialog (if present)

**Expected:**
- Booking row disappears from the table
- Stats: Total Bookings = 0, Total Revenue = $0.00
- Bookings table shows empty state

---

## 8. Test Cases — API

> Implemented in Sprint 3 across four spec files in `src/api/hotel/`:
> `properties.api.spec.ts` · `room-types.api.spec.ts` · `bookings.api.spec.ts` · `reviews.api.spec.ts`
>
> State strategy: since `POST /api/hotel/reset` wipes **all** hotel data (see §2),
> every suite uses a single `beforeAll` reset — no manual cleanup of bookings/reviews
> is needed between suites.

### Properties

| ID | Description | Type | Input | Expected |
|----|-------------|------|-------|----------|
| TC-H-API-PROP-001 | GET all properties after reset | Positive | — | 200 · array length = 5 (seed) |
| TC-H-API-PROP-002 | GET property by ID | Positive | Valid property ID | 200 · matches the requested property |
| TC-H-API-PROP-003 | GET property by non-existent ID | Negative | Random UUID | 404 |
| TC-H-API-PROP-004 | Create property with required fields | Positive | name, city, country, address | 201 · all fields present in response |
| TC-H-API-PROP-005 | Create property missing required field | Negative | Missing `name` | 400 |
| TC-H-API-PROP-006 | Partial update changes only one field | Edge | `PUT { "city": "Boston" }` | 200 · only city changed |
| TC-H-API-PROP-007 | Delete property | Positive | Valid property ID | 200 · then GET/:id → 404 |
| TC-H-API-PROP-008 | Delete property cascades to its room types | Edge | Create property + room type → delete property | Room type no longer in GET all |

### Room Types

| ID | Description | Type | Input | Expected |
|----|-------------|------|-------|----------|
| TC-H-API-RT-001 | GET all room types after reset | Positive | — | 200 · array length = 14 (seed) |
| TC-H-API-RT-002 | GET room type by ID | Positive | Valid room type ID | 200 · matches the requested room type |
| TC-H-API-RT-003 | Create room type with required fields | Positive | property_id, name, bed_type, max_occupancy, price_per_night, total_rooms | 201 |
| TC-H-API-RT-004 | Create room type with invalid bed_type | Negative | `bed_type="Hammock"` | 400 |
| TC-H-API-RT-005 | Create room type without property_id | Negative | Missing `property_id` | 400 |
| TC-H-API-RT-006 | Partial update changes only price | Edge | `PUT { "price_per_night": 199.00 }` | 200 · only price changed |
| TC-H-API-RT-007 | Delete room type | Positive | Valid room type ID | 200 |

### Bookings

| ID | Description | Type | Input | Expected |
|----|-------------|------|-------|----------|
| TC-H-API-BOOK-001 | Create booking with required fields | Positive | All required fields | 201 · `confirmation_number` matches `/^HB\d{8}-[A-Z0-9]{6}$/` |
| TC-H-API-BOOK-002 | Create booking missing required field | Negative | Missing `guest_email` | 400 |
| TC-H-API-BOOK-003 | GET all bookings | Positive | — | 200 · array of created bookings |
| TC-H-API-BOOK-004 | GET bookings filtered by status | Positive | `?status=PENDING` | 200 · only PENDING bookings returned |
| TC-H-API-BOOK-005 | GET booking by ID | Positive | Valid booking ID | 200 |
| TC-H-API-BOOK-006 | GET booking by non-existent ID | Negative | Random UUID | 404 |
| TC-H-API-BOOK-007 | Full lifecycle PATCH transitions | Positive | PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT | Each PATCH → 200, status updates correctly |
| TC-H-API-BOOK-008 | CANCELLED without cancellation_reason | Negative | `{ "status": "CANCELLED" }` | 400 |
| TC-H-API-BOOK-009 | CANCELLED with cancellation_reason | Positive | `{ "status": "CANCELLED", "cancellation_reason": "..." }` | 200 |
| TC-H-API-BOOK-010 | PATCH to NO_SHOW | Positive | `{ "status": "NO_SHOW" }` | 200 |
| TC-H-API-BOOK-011 | PATCH with invalid status | Negative | `{ "status": "FINISHED" }` | 400 |
| TC-H-API-BOOK-012 | Delete booking | Positive | Valid booking ID | 200 · then GET/:id → 404 |
| TC-H-API-BOOK-013 | total_amount calculated correctly | Positive | price_per_night × nights × number_of_rooms | `total_amount` matches expected value |
| TC-H-API-BOOK-014 | Confirmation number format | Edge | Any created booking | Matches `/^HB\d{8}-[A-Z0-9]{6}$/` |

### Availability

| ID | Description | Type | Input | Expected |
|----|-------------|------|-------|----------|
| TC-H-API-AVAIL-001 | GET availability with valid params | Positive | property_id, check_in, check_out | 200 |
| TC-H-API-AVAIL-002 | GET availability missing required param | Negative | Missing `check_out` | 400 |

> 🔲 Availability test cases are documented but **not yet implemented** —
> planned alongside the booking date-validation work.

### Reviews

| ID | Description | Type | Input | Expected |
|----|-------------|------|-------|----------|
| TC-H-API-REV-001 | Create review for CHECKED_OUT booking | Positive | booking_id (CHECKED_OUT), property_id, rating | 201 |
| TC-H-API-REV-002 | Create review for booking NOT CHECKED_OUT | Negative | booking_id (PENDING) | 400 |
| TC-H-API-REV-003 | Create review missing booking_id | Negative | Missing `booking_id` | 400 |
| TC-H-API-REV-004 | Create review missing property_id | Negative | Missing `property_id` | 400 |
| TC-H-API-REV-005 | Create review missing rating | Negative | Missing `rating` | 400 |
| TC-H-API-REV-006 | Create review with rating out of range | Negative | `rating=0` and `rating=6` | 400 |
| TC-H-API-REV-007 | GET all reviews | Positive | — | 200 · includes the created review |

---

## Implementation Notes

### `playwright.config.ts`

```typescript
// Hotel uses the same base URL — no additional config needed
baseURL: process.env.QACLOUD_BASE_URL
```

### Authentication

```typescript
// Same API key as Market
headers: {
  'Authorization': process.env.QACLOUD_API_KEY
}
```

### Reset Strategy

```typescript
// In beforeAll of every Hotel API/E2E suite
await request.post('/api/hotel/reset', { headers: authHeaders });
// ✅ Reset wipes ALL hotel data: Properties and Room Types restored to seed,
// Bookings and Reviews wiped to zero. A single beforeAll reset per suite is
// enough — no manual DELETE cleanup of bookings/reviews is required.
```

### Booking Status Update — PATCH, not PUT

```typescript
// ⚠️ Status updates use a dedicated PATCH endpoint, not PUT on the booking itself
await request.patch(`/api/hotel/bookings/${bookingId}/status`, {
  headers: authHeaders,
  data: { status: 'CONFIRMED' },
});

// CANCELLED requires cancellation_reason in the same body
await request.patch(`/api/hotel/bookings/${bookingId}/status`, {
  headers: authHeaders,
  data: { status: 'CANCELLED', cancellation_reason: 'Guest request' },
});
```

### Booking Preconditions via API

```typescript
// For tests that need a booking in a specific status,
// create it via API in beforeAll to avoid depending on UI flows
// Example: drive a booking to CHECKED_OUT in beforeAll for TC-H-E2E-004
```

### Confirmation Number Validation

```typescript
expect(booking.confirmation_number).toMatch(/^HB\d{8}-[A-Z0-9]{6}$/)
```

### Review Rating Field

```typescript
// ⚠️ The API field is `rating`, not `overall_rating`.
// The UI may label it "Overall Rating" for the user, but the request body key is `rating`.
expect(review.rating).toBeGreaterThanOrEqual(1);
expect(review.rating).toBeLessThanOrEqual(5);
```

### Dynamic Room Type Select

```typescript
// After selecting a property, wait for room types to load before selecting
await page.waitForFunction(() => {
  const select = document.querySelector('#bookingRoomTypeId') as HTMLSelectElement;
  return select && select.options.length > 1;
});
```