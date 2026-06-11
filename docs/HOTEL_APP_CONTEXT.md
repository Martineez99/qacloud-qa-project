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
 ├── Bookings       (belong to a Property + Room Type — NOT reset)
 └── Reviews        (belong to a Property via a CHECKED_OUT Booking — NOT reset)
```

> ⚠️ `POST /api/hotel/reset` restores **Properties and Room Types only**.
> Bookings and Reviews are NOT affected by reset.

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
| **Reset endpoint** | `POST /api/hotel/reset` restores Properties and Room Types to seed state | Deterministic test setup |
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
1. POST /api/hotel/reset              → Deterministic state (5 seed properties + 14 room types)
2. GET  /api/hotel/properties         → List all properties
3. POST /api/hotel/properties         → Create property (required: name, city, country, address)
4. DELETE /api/hotel/properties/:id   → Delete property (CASCADE removes its room types)
```

### 5.2 Room Types Flow

```
1. POST /api/hotel/room-types         → Create room type (required: property_id, name, bed_type,
                                        max_occupancy, price_per_night, total_rooms)
2. GET  /api/hotel/room-types         → List all room types
3. DELETE /api/hotel/room-types/:id   → Delete room type
```

### 5.3 Booking Lifecycle Flow

```
1. POST /api/hotel/bookings           → Create booking (required: property_id, room_type_id,
                                        guest_name, guest_email, guest_phone,
                                        check_in_date, check_out_date, num_guests)
2. GET  /api/hotel/bookings           → List all bookings (optional: ?status=PENDING)
3. GET  /api/hotel/bookings/:id       → Get specific booking
4. PUT  /api/hotel/bookings/:id       → Update status or notes
   Valid transitions: PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT
                      Any status → CANCELLED (requires cancellation_reason)
                      Any status → NO_SHOW
5. DELETE /api/hotel/bookings/:id     → Delete booking record
```

### 5.4 Reviews Flow

```
1. [Booking with status CHECKED_OUT]  → Required precondition
2. POST /api/hotel/reviews            → Create review (required: booking_id, property_id,
                                        overall_rating 1-5)
3. GET  /api/hotel/reviews            → List all reviews
```

---

## 6. API Reference

> **Authentication:** all endpoints require `Authorization: qac_live_...`

### 6.1 Properties

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `GET` | `/api/hotel/properties` | List all properties | 200 |
| `POST` | `/api/hotel/properties` | Create property | 201 |
| `DELETE` | `/api/hotel/properties/:id` | Delete property (cascade) | 200 |
| `POST` | `/api/hotel/reset` | Reset to seed state | 200 |

### 6.2 Room Types

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `GET` | `/api/hotel/room-types` | List all room types | 200 |
| `POST` | `/api/hotel/room-types` | Create room type | 201 |
| `DELETE` | `/api/hotel/room-types/:id` | Delete room type | 200 |

### 6.3 Bookings

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `POST` | `/api/hotel/bookings` | Create booking | 201 |
| `GET` | `/api/hotel/bookings` | List all bookings | 200 |
| `GET` | `/api/hotel/bookings/:id` | Get specific booking | 200 |
| `PUT` | `/api/hotel/bookings/:id` | Update status / notes | 200 |
| `DELETE` | `/api/hotel/bookings/:id` | Delete booking | 200 |

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
  "num_guests":     2,               // required
  "num_rooms":      1,               // optional — default 1
  "special_requests": "Late check-in" // optional
}
```

**Request body — `PUT /api/hotel/bookings/:id`:**

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

### 6.4 Reviews

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `POST` | `/api/hotel/reviews` | Create review | 201 |
| `GET` | `/api/hotel/reviews` | List all reviews | 200 |

**Request body — `POST /api/hotel/reviews`:**

```json
{
  "booking_id":          "uuid",  // required — must be CHECKED_OUT
  "property_id":         "uuid",  // required
  "overall_rating":      5,       // required — 1 to 5
  "cleanliness_rating":  4,       // optional — 1 to 5
  "service_rating":      5,       // optional — 1 to 5
  "location_rating":     5,       // optional — 1 to 5
  "value_rating":        4,       // optional — 1 to 5
  "comment":             "Excellent stay!" // optional
}
```

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

> To be defined in Sprint 3 — API phase.
> Will cover: properties CRUD, room types CRUD, booking lifecycle, edge cases
> (date validation, overlapping bookings, max occupancy), and reviews.

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
// In beforeAll of every Hotel E2E suite
await request.post('/api/hotel/reset', { headers: authHeaders });
// ⚠️ Reset affects Properties and Room Types only
// Bookings and Reviews are NOT reset — clean them via DELETE in afterAll if needed
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

### Dynamic Room Type Select

```typescript
// After selecting a property, wait for room types to load before selecting
await page.waitForFunction(() => {
  const select = document.querySelector('#bookingRoomTypeId') as HTMLSelectElement;
  return select && select.options.length > 1;
});
```
