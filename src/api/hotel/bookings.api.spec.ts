// ┌─────────────────────────────────────────────────────────────────┐
// │  bookings.api.spec.ts                                           │
// │  Lifecycle completo de bookings: CREATE, GET, PATCH, DELETE     │
// │                                                                 │
// │  Cubre: TC-H-API-BOOK-001 a TC-H-API-BOOK-014                  │
// └─────────────────────────────────────────────────────────────────┘

import { test, expect } from '../../fixtures/api.fixture';
import { epic, feature, story, severity, tag } from 'allure-js-commons';
import { Booking, CreateBookingPayload } from '../../types/hotel.types';

// ─────────────────────────────────────────────────────────────────
//  Helper local — payload base reutilizable
//  check_in: mañana · check_out: en 3 días (2 noches siempre)
// ─────────────────────────────────────────────────────────────────
function buildBookingPayload(
  propertyId: string,
  roomTypeId: string,
  overrides: Partial<CreateBookingPayload> = {}
): CreateBookingPayload {
  const checkIn  = new Date();
  checkIn.setDate(checkIn.getDate() + 1);
  const checkOut = new Date();
  checkOut.setDate(checkOut.getDate() + 3);

  return {
    property_id:    propertyId,
    room_type_id:   roomTypeId,
    guest_name:     'Test Guest',
    guest_email:    'test@qacloud.dev',
    guest_phone:    '+34600000000',
    check_in_date:  checkIn.toISOString().split('T')[0],
    check_out_date: checkOut.toISOString().split('T')[0],
    number_of_guests:     2,
    number_of_rooms:      1,
    ...overrides,
  };
}

test.describe('Hotel Bookings API', () => {

  test.describe.configure({ mode: 'serial' }); // todos en orden, 1 worker

  // Reset completo antes de cada test.
  // hotelReset() garantiza: 5 seed properties, 14 seed room types,
  // 0 bookings, 0 reviews — estado determinista en cada test.
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.hotelReset();
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-001 — POST creates booking with valid confirmation number
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/bookings creates booking and returns 201 with valid confirmation_number', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Create booking');
    await severity('critical');
    await tag('hotel');
    await tag('bookings');
    await tag('smoke');

    // ARRANGE
    const property = await apiClient.getPropertyByName('Grand Plaza Hotel');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Standard Double Room');


    // ACT
    const booking = await apiClient.createBooking(
      buildBookingPayload(property.id, roomType.id)
    );

    // ASSERT
    expect(booking.id).toBeTruthy();
    expect(booking.status).toBe('PENDING');
    expect(booking.property_id).toBe(property.id);
    expect(booking.room_type_id).toBe(roomType.id);

    // TC-H-API-BOOK-014: formato del confirmation number
    expect(booking.confirmation_number).toMatch(/^HB\d{8}-[A-Z0-9]{6}$/);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-002 — POST missing required field returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/bookings returns 400 when required field is missing', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Create booking');
    await severity('normal');
    await tag('hotel');
    await tag('bookings');
    await tag('negative');
    await tag('validation');

    // ARRANGE
    const property = await apiClient.getPropertyByName('Grand Plaza Hotel');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Standard Double Room');
    const payload  = buildBookingPayload(property.id, roomType.id);

    // ACT — guest_email omitido intencionalmente
    const response = await apiClient.post('/api/hotel/bookings', {
      data: {
        ...payload,
        guest_email: undefined,
      },
    });

    // ASSERT
    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-003 — GET all bookings returns all created bookings
  // ════════════════════════════════════════════════════════════════
  test('GET /api/hotel/bookings returns 200 with all bookings', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('List bookings');
    await severity('normal');
    await tag('hotel');
    await tag('bookings');

    // ARRANGE — crear dos bookings para validar que devuelve todas
    const property = await apiClient.getPropertyByName('Seaside Resort');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Garden View Room');

    await apiClient.createBooking(buildBookingPayload(property.id, roomType.id, { guest_name: 'Guest One' }));
    await apiClient.createBooking(buildBookingPayload(property.id, roomType.id, { guest_name: 'Guest Two' }));

    // ACT
    const bookings = await apiClient.getBookings();

    // ASSERT
    expect(bookings.length).toBe(2);
    expect(bookings.some(b => b.guest_name === 'Guest One')).toBe(true);
    expect(bookings.some(b => b.guest_name === 'Guest Two')).toBe(true);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-004 — GET bookings filtered by status
  // ════════════════════════════════════════════════════════════════
  test('GET /api/hotel/bookings?status=PENDING returns only PENDING bookings', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Filter bookings by status');
    await severity('normal');
    await tag('hotel');
    await tag('bookings');
    await tag('filter');

    // ARRANGE — una booking PENDING y otra avanzada a CONFIRMED
    const property   = await apiClient.getPropertyByName('Grand Plaza Hotel');
    const roomType   = await apiClient.getRoomTypeByName(property.id, 'Deluxe King Room');

    const pending   = await apiClient.createBooking(buildBookingPayload(property.id, roomType.id, { guest_name: 'Pending Guest' }));
    const toConfirm = await apiClient.createBooking(buildBookingPayload(property.id, roomType.id, { guest_name: 'Confirmed Guest' }));

    await apiClient.updateBookingStatus(toConfirm.id, { status: 'CONFIRMED' });

    // ACT
    const pendingOnly = await apiClient.getBookings('PENDING');

    // ASSERT — solo aparece la PENDING, no la CONFIRMED
    expect(pendingOnly.every(b => b.status === 'PENDING')).toBe(true);
    expect(pendingOnly.some(b => b.id === pending.id)).toBe(true);
    expect(pendingOnly.some(b => b.id === toConfirm.id)).toBe(false);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-005 — GET booking by ID returns the correct one
  // ════════════════════════════════════════════════════════════════
  test('GET /api/hotel/bookings/:id returns 200 with the correct booking', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Get booking by ID');
    await severity('normal');
    await tag('hotel');
    await tag('bookings');

    // ARRANGE
    const property = await apiClient.getPropertyByName('Boutique Garden Hotel');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Artisan Room');
    const created  = await apiClient.createBooking(buildBookingPayload(property.id, roomType.id));

    // ACT
    const fetched = await apiClient.getBookingById(created.id);

    // ASSERT
    expect(fetched.id).toBe(created.id);
    expect(fetched.confirmation_number).toBe(created.confirmation_number);
    expect(fetched.guest_name).toBe(created.guest_name);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-006 — GET non-existent booking returns 404
  // ════════════════════════════════════════════════════════════════
  test('GET /api/hotel/bookings/:id returns 404 for non-existent ID', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Get booking by ID');
    await severity('normal');
    await tag('hotel');
    await tag('bookings');
    await tag('negative');

    // ACT — UUID sintácticamente válido pero inexistente
    const response = await apiClient.get('/api/hotel/bookings/00000000-0000-0000-0000-000000000000');

    // ASSERT
    expect(response.status).toBe(404);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-007 — Full lifecycle: PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT
  // ════════════════════════════════════════════════════════════════
  test('PATCH lifecycle PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Booking lifecycle');
    await severity('critical');
    await tag('hotel');
    await tag('bookings');
    await tag('lifecycle');
    await tag('smoke');

    // ARRANGE
    const property = await apiClient.getPropertyByName('Grand Plaza Hotel');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Executive Suite');
    const booking  = await apiClient.createBooking(buildBookingPayload(property.id, roomType.id));
    expect(booking.status).toBe('PENDING');

    // PENDING → CONFIRMED
    const confirmed = await apiClient.updateBookingStatus(booking.id, { status: 'CONFIRMED' });
    expect(confirmed.status).toBe('CONFIRMED');

    // CONFIRMED → CHECKED_IN
    const checkedIn = await apiClient.updateBookingStatus(booking.id, { status: 'CHECKED_IN' });
    expect(checkedIn.status).toBe('CHECKED_IN');

    // CHECKED_IN → CHECKED_OUT
    const checkedOut = await apiClient.updateBookingStatus(booking.id, { status: 'CHECKED_OUT' });
    expect(checkedOut.status).toBe('CHECKED_OUT');

    // Verificar estado final via GET — no solo confiamos en el cuerpo del PATCH
    const final = await apiClient.getBookingById(booking.id);
    expect(final.status).toBe('CHECKED_OUT');
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-008 — PATCH CANCELLED without cancellation_reason returns 200
  //  cancellation_reason es opcional — la API acepta CANCELLED sin él
  //  y devuelve cancellation_reason: null en la respuesta.
  //  Confirmado en Swagger (/hotel/docs) y en la UI de qacloud.dev.
  // ════════════════════════════════════════════════════════════════
  test('PATCH CANCELLED without cancellation_reason returns 200 and null reason', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Cancellation validation');
    await severity('normal');
    await tag('hotel');
    await tag('bookings');
    await tag('cancellation');
 
    // ARRANGE
    const property = await apiClient.getPropertyByName('Downtown Budget Inn');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Standard Queen Room');
    const booking  = await apiClient.createBooking(buildBookingPayload(property.id, roomType.id));
 
    // ACT — cancelar sin motivo (campo opcional según Swagger y UI)
    const response = await apiClient.patch<Booking>(
      `/api/hotel/bookings/${booking.id}/status`,
      { data: { status: 'CANCELLED' } }
    );
 
    // ASSERT — la API acepta la cancelación sin reason
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('CANCELLED');
    expect(response.body.cancellation_reason).toBeNull();
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-009 — PATCH CANCELLED with cancellation_reason returns 200
  //  Cuando se envía cancellation_reason, la API lo persiste correctamente.
  // ════════════════════════════════════════════════════════════════
  test('PATCH CANCELLED with cancellation_reason returns 200 and persists the reason', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Cancellation validation');
    await severity('normal');
    await tag('hotel');
    await tag('bookings');
    await tag('cancellation');
 
    // ARRANGE
    const property = await apiClient.getPropertyByName('Downtown Budget Inn');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Economy Double Room');
    const booking  = await apiClient.createBooking(buildBookingPayload(property.id, roomType.id));
 
    // ACT — cancelar con motivo (campo opcional que cuando se envía debe persistirse)
    const cancelled = await apiClient.updateBookingStatus(booking.id, {
      status:              'CANCELLED',
      cancellation_reason: 'Guest requested cancellation',
    });
 
    // ASSERT — status actualizado y reason persistido
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancellation_reason).toBe('Guest requested cancellation');
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-010 — PATCH to NO_SHOW returns 200
  // ════════════════════════════════════════════════════════════════
  test('PATCH /api/hotel/bookings/:id/status to NO_SHOW returns 200', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Booking lifecycle');
    await severity('normal');
    await tag('hotel');
    await tag('bookings');
    await tag('lifecycle');

    // ARRANGE
    const property = await apiClient.getPropertyByName('Mountain View Lodge');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Budget Twin Room');
    const booking  = await apiClient.createBooking(buildBookingPayload(property.id, roomType.id));

    // ACT
    const noShow = await apiClient.updateBookingStatus(booking.id, { status: 'NO_SHOW' });

    // ASSERT
    expect(noShow.status).toBe('NO_SHOW');
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-011 — PATCH with invalid status returns 400
  // ════════════════════════════════════════════════════════════════
  test('PATCH /api/hotel/bookings/:id/status returns 400 for invalid status', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Booking lifecycle');
    await severity('normal');
    await tag('hotel');
    await tag('bookings');
    await tag('negative');
    await tag('validation');

    // ARRANGE
    const property = await apiClient.getPropertyByName('Mountain View Lodge');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Mountain View Room');
    const booking  = await apiClient.createBooking(buildBookingPayload(property.id, roomType.id));

    // ACT — status fuera del union de BookingStatus
    const response = await apiClient.patch(`/api/hotel/bookings/${booking.id}/status`, {
      data: { status: 'FINISHED' },
    });

    // ASSERT
    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-012 — DELETE booking then GET returns 404
  // ════════════════════════════════════════════════════════════════
  test('DELETE /api/hotel/bookings/:id removes booking and GET returns 404', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Delete booking');
    await severity('critical');
    await tag('hotel');
    await tag('bookings');

    // ARRANGE
    const property = await apiClient.getPropertyByName('Boutique Garden Hotel');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Cozy Single');
    const booking  = await apiClient.createBooking(buildBookingPayload(property.id, roomType.id));

    // ACT
    await apiClient.deleteBooking(booking.id);

    // ASSERT — ya no existe
    const response = await apiClient.get(`/api/hotel/bookings/${booking.id}`);
    expect(response.status).toBe(404);

    // Y no aparece en el listado
    const allBookings = await apiClient.getBookings();
    expect(allBookings.some(b => b.id === booking.id)).toBe(false);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-013 — total_amount = price_per_night × nights × number_of_rooms
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/bookings total_amount matches price_per_night × nights × number_of_rooms', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Total amount calculation');
    await severity('critical');
    await tag('hotel');
    await tag('bookings');
    await tag('data-integrity');

    // ARRANGE — Standard Double Room $220/noche (seed conocido)
    const property      = await apiClient.getPropertyByName('Grand Plaza Hotel');
    const roomType      = await apiClient.getRoomTypeByName(property.id, 'Standard Double Room');
    const pricePerNight = roomType.price_per_night; // 220
    const numRooms      = 1;

    // Fechas controladas: +1 día a +3 días = exactamente 2 noches
    const checkIn  = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 3);
    const numNights = Math.round(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    // ACT
    const booking = await apiClient.createBooking({
      property_id:    property.id,
      room_type_id:   roomType.id,
      guest_name:     'Amount Test Guest',
      guest_email:    'amount@qacloud.dev',
      guest_phone:    '+34600000001',
      check_in_date:  checkIn.toISOString().split('T')[0],
      check_out_date: checkOut.toISOString().split('T')[0],
      number_of_guests:     2,
      number_of_rooms:      numRooms,
    });

    // ASSERT
    const expectedTotal = pricePerNight * numNights * numRooms;
    expect(booking.total_amount).toBeCloseTo(expectedTotal, 2);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-BOOK-014 — confirmation_number format (test dedicado)
  //  También cubierto en BOOK-001 — aquí lo aislamos para reportes
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/bookings confirmation_number matches /^HB\\d{8}-[A-Z0-9]{6}$/', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Booking Management');
    await story('Confirmation number format');
    await severity('normal');
    await tag('hotel');
    await tag('bookings');
    await tag('format');

    // ARRANGE
    const property = await apiClient.getPropertyByName('Seaside Resort');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Ocean View Suite');

    // ACT
    const booking = await apiClient.createBooking(
      buildBookingPayload(property.id, roomType.id)
    );

    // ASSERT
    expect(booking.confirmation_number).toMatch(/^HB\d{8}-[A-Z0-9]{6}$/);
  });

});
