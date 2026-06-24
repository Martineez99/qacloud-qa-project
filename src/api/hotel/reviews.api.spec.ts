// ┌─────────────────────────────────────────────────────────────────┐
// │  reviews.api.spec.ts                                            │
// │  Creación y listado de reviews: prerequisito CHECKED_OUT        │
// │                                                                 │
// │  Cubre: TC-H-API-REV-001 a TC-H-API-REV-007                    │
// └─────────────────────────────────────────────────────────────────┘

import { test, expect } from '../../fixtures/api.fixture';
import { epic, feature, story, severity, tag } from 'allure-js-commons';
import { Booking, Review } from '../../types/hotel.types';

test.describe('Hotel Reviews API', () => {

  test.describe.configure({ mode: 'serial' }); // todos en orden, 1 worker

  // Reset completo antes de cada test.
  // hotelReset() garantiza: 5 seed properties, 14 seed room types,
  // 0 bookings, 0 reviews — estado determinista en cada test.
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.hotelReset();
  });

  // ─────────────────────────────────────────────────────────────────
  //  Helper local — crea una booking y la lleva a CHECKED_OUT
  //  Es la precondición necesaria para poder crear reviews.
  // ─────────────────────────────────────────────────────────────────
  async function createCheckedOutBooking(apiClient: any): Promise<Booking> {
    const property = await apiClient.getPropertyByName('Grand Plaza Hotel');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Standard Double Room');

    const checkIn  = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 3);

    const booking = await apiClient.createBooking({
      property_id:      property.id,
      room_type_id:     roomType.id,
      guest_name:       'Review Test Guest',
      guest_email:      'review@qacloud.dev',
      guest_phone:      '+34600000002',
      check_in_date:    checkIn.toISOString().split('T')[0],
      check_out_date:   checkOut.toISOString().split('T')[0],
      number_of_guests: 2,
      number_of_rooms:  1,
    });

    // Lifecycle completo hasta CHECKED_OUT
    await apiClient.updateBookingStatus(booking.id, { status: 'CONFIRMED' });
    await apiClient.updateBookingStatus(booking.id, { status: 'CHECKED_IN' });
    await apiClient.updateBookingStatus(booking.id, { status: 'CHECKED_OUT' });

    // Devolvemos el booking actualizado con el status final
    return await apiClient.getBookingById(booking.id);
  }

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-REV-001 — POST review for CHECKED_OUT booking returns 201
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/reviews creates review for CHECKED_OUT booking and returns 201', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Review Management');
    await story('Create review');
    await severity('critical');
    await tag('hotel');
    await tag('reviews');
    await tag('smoke');

    // ARRANGE — booking en CHECKED_OUT (precondición de negocio)
    const booking = await createCheckedOutBooking(apiClient);
    expect(booking.status).toBe('CHECKED_OUT');

    // ACT
    const review = await apiClient.createReview({
      booking_id:          booking.id,
      property_id:         booking.property_id,
      rating:              5,
      cleanliness_rating:  4,
      service_rating:      5,
      location_rating:     5,
      value_rating:        4,
      comment:             'Excellent stay, would recommend!',
    });

    // ASSERT
    expect(review.id).toBeTruthy();
    expect(review.booking_id).toBe(booking.id);
    expect(review.property_id).toBe(booking.property_id);
    expect(review.rating).toBe(5);
    expect(review.comment).toBe('Excellent stay, would recommend!');
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-REV-002 — POST review for non-CHECKED_OUT booking returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/reviews returns 400 for booking not in CHECKED_OUT status', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Review Management');
    await story('Create review');
    await severity('critical');
    await tag('hotel');
    await tag('reviews');
    await tag('negative');
    await tag('precondition');

    // ARRANGE — booking en PENDING (no ha completado el lifecycle)
    const property = await apiClient.getPropertyByName('Seaside Resort');
    const roomType = await apiClient.getRoomTypeByName(property.id, 'Garden View Room');

    const checkIn  = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 3);

    const pendingBooking = await apiClient.createBooking({
      property_id:      property.id,
      room_type_id:     roomType.id,
      guest_name:       'Pending Guest',
      guest_email:      'pending@qacloud.dev',
      guest_phone:      '+34600000003',
      check_in_date:    checkIn.toISOString().split('T')[0],
      check_out_date:   checkOut.toISOString().split('T')[0],
      number_of_guests: 1,
      number_of_rooms:  1,
    });

    expect(pendingBooking.status).toBe('PENDING');

    // ACT — intentar crear review con booking que no es CHECKED_OUT
    const response = await apiClient.post('/api/hotel/reviews', {
      data: {
        booking_id:  pendingBooking.id,
        property_id: pendingBooking.property_id,
        rating:      4,
      },
    });

    // ASSERT
    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-REV-003 — POST review missing booking_id returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/reviews returns 400 when booking_id is missing', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Review Management');
    await story('Create review');
    await severity('normal');
    await tag('hotel');
    await tag('reviews');
    await tag('negative');
    await tag('validation');

    // ARRANGE
    const booking = await createCheckedOutBooking(apiClient);

    // ACT — booking_id omitido intencionalmente
    const response = await apiClient.post('/api/hotel/reviews', {
      data: {
        property_id: booking.property_id,
        rating:      4,
        // booking_id: omitido intencionalmente
      },
    });

    // ASSERT
    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-REV-004 — POST review missing property_id returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/reviews returns 400 when property_id is missing', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Review Management');
    await story('Create review');
    await severity('normal');
    await tag('hotel');
    await tag('reviews');
    await tag('negative');
    await tag('validation');

    // ARRANGE
    const booking = await createCheckedOutBooking(apiClient);

    // ACT — property_id omitido intencionalmente
    const response = await apiClient.post('/api/hotel/reviews', {
      data: {
        booking_id: booking.id,
        rating:     4,
        // property_id: omitido intencionalmente
      },
    });

    // ASSERT
    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-REV-005 — POST review missing rating returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/reviews returns 400 when rating is missing', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Review Management');
    await story('Create review');
    await severity('normal');
    await tag('hotel');
    await tag('reviews');
    await tag('negative');
    await tag('validation');

    // ARRANGE
    const booking = await createCheckedOutBooking(apiClient);

    // ACT — rating omitido intencionalmente
    const response = await apiClient.post('/api/hotel/reviews', {
      data: {
        booking_id:  booking.id,
        property_id: booking.property_id,
        // rating: omitido intencionalmente
      },
    });

    // ASSERT
    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-REV-006 — POST review with rating out of range returns 400
  //  Válidos: 1–5. Testeamos el límite inferior (0) y superior (6).
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/reviews returns 400 for rating = 0 (below minimum)', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Review Management');
    await story('Create review');
    await severity('normal');
    await tag('hotel');
    await tag('reviews');
    await tag('negative');
    await tag('validation');
    await tag('boundary');

    // ARRANGE
    const booking = await createCheckedOutBooking(apiClient);

    // ACT — rating=0, por debajo del mínimo permitido (1)
    const response = await apiClient.post('/api/hotel/reviews', {
      data: {
        booking_id:  booking.id,
        property_id: booking.property_id,
        rating:      0,
      },
    });

    // ASSERT
    expect(response.status).toBe(400);
  });

  test('POST /api/hotel/reviews returns 400 for rating = 6 (above maximum)', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Review Management');
    await story('Create review');
    await severity('normal');
    await tag('hotel');
    await tag('reviews');
    await tag('negative');
    await tag('validation');
    await tag('boundary');

    // ARRANGE
    const booking = await createCheckedOutBooking(apiClient);

    // ACT — rating=6, por encima del máximo permitido (5)
    const response = await apiClient.post('/api/hotel/reviews', {
      data: {
        booking_id:  booking.id,
        property_id: booking.property_id,
        rating:      6,
      },
    });

    // ASSERT
    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-REV-007 — GET all reviews returns the created review
  // ════════════════════════════════════════════════════════════════
  test('GET /api/hotel/reviews returns 200 with the created review', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Review Management');
    await story('List reviews');
    await severity('normal');
    await tag('hotel');
    await tag('reviews');

    // ARRANGE — crear una review
    const booking = await createCheckedOutBooking(apiClient);

    const created = await apiClient.createReview({
      booking_id:  booking.id,
      property_id: booking.property_id,
      rating:      4,
      comment:     'Great location and service.',
    });

    // ACT
    const reviews = await apiClient.getReviews();

    // ASSERT — la review creada aparece en el listado
    expect(reviews.length).toBeGreaterThanOrEqual(1);
    const found = reviews.find((r: Review) => r.id === created.id);
    expect(found).toBeDefined();
    expect(found!.rating).toBe(4);
    expect(found!.comment).toBe('Great location and service.');
  });

});
