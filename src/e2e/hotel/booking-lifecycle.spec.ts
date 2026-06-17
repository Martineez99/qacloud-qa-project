import { test, expect } from '@fixtures/base.fixture';

// ─────────────────────────────────────────────────────────────────────────────
// Hotel — Booking Lifecycle E2E
//
// hotel.html es una SPA con 4 tabs (Properties / Room Types / Bookings / Reviews).
// Accedemos a cada sección a través de hotelPage.bookings, hotelPage.reviews, etc.
// que comparten la misma instancia de Page.
//
// Seed data disponible tras reset:
//   - 5 properties (Grand Plaza Hotel, Seaside Resort, Mountain View Lodge,
//     Downtown Budget Inn, Boutique Garden Hotel)
//   - 14 room types distribuidos entre ellas
//   - Bookings y Reviews NO se resetean — se limpian en afterAll
//
// Test cases basados en HOTEL_APP_CONTEXT.md:
//   TC-H-E2E-001  Booking creation and stats update
//   TC-H-E2E-002  Full lifecycle PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT
//   TC-H-E2E-003  Cancellation with conditional reason field
//   TC-H-E2E-004  Review creation after CHECKED_OUT
//   TC-H-E2E-005  Review modal only shows CHECKED_OUT bookings
//   TC-H-E2E-006  Booking delete removes row and updates stats
// ─────────────────────────────────────────────────────────────────────────────

// ── Constantes de seed data ───────────────────────────────────────────────────
// Usamos los datos seed que siempre están disponibles tras el reset.
// Esto evita hardcodear IDs y hace los tests más legibles.

const PROPERTY_NAME    = 'Grand Plaza Hotel - New York';
const ROOM_TYPE_NAME   = 'Standard Double Room';
const PRICE_PER_NIGHT  = 220;   // $220/night — dato del seed
const CHECK_IN_DATE    = '2027-08-01';
const CHECK_OUT_DATE   = '2027-08-03';   // 2 noches
const EXPECTED_TOTAL   = PRICE_PER_NIGHT * 2;  // $440.00

const GUEST = {
  name:  'Test Guest',
  email: 'testguest@qa.com',
  phone: '+1234567890',
};

// ═════════════════════════════════════════════════════════════════════════════
//  SUITE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Hotel - Booking Lifecycle', () => {

  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ hotelPage }) => {
    // Reset de properties y room types — garantiza seed data disponible
    await hotelPage.getPage().request.post(
      `${process.env.QACLOUD_BASE_URL}/api/hotel/reset`,
      { headers: apiHeaders() }
    );
    // Limpiamos bookings previas para partir de estado limpio
    await deleteAllBookings(hotelPage.getPage());

    // Recargamos la página para que la UI refleje el estado post-reset
    await hotelPage.getPage().reload();
    await hotelPage.getPage().waitForLoadState('networkidle');
  });

  // ── TC-H-E2E-001 ──────────────────────────────────────────────────────────

  test('TC-H-E2E-001: booking creation shows correct row and updates stats',
    async ({ hotelPage }) => {

      // ── ARRANGE ──────────────────────────────────────────────────────────
      await hotelPage.goToBookings();

      // Stats iniciales deben ser 0
      const totalBefore = await hotelPage.bookings.getStatValue('Total Bookings');
      expect(totalBefore).toBe('0');

      // ── ACT: crear booking desde la UI ───────────────────────────────────
      await hotelPage.bookings.createBooking({
        propertyName:  PROPERTY_NAME,
        roomTypeName:  ROOM_TYPE_NAME,
        guestName:     GUEST.name,
        guestEmail:    GUEST.email,
        guestPhone:    GUEST.phone,
        checkIn:       CHECK_IN_DATE,
        checkOut:      CHECK_OUT_DATE,
        numGuests:     2,
        numRooms:      1,
      });

      // ── ASSERT: fila en tabla ─────────────────────────────────────────────
      const bookingCount = await hotelPage.bookings.getBookingCount();
      expect(bookingCount).toBe(1);

      // La fila debe mostrar el nombre del guest
      const firstRow = hotelPage.bookings.tableRows.first();
      await expect(firstRow).toContainText(GUEST.name);
      await expect(firstRow).toContainText('Grand Plaza Hotel');
      await expect(firstRow).toContainText('Standard Double Room');

      // ── ASSERT: confirmation number format ────────────────────────────────
      const confirmNum = (await firstRow.locator('td').first().textContent() ?? '').trim();
      expect(confirmNum).toMatch(/^HB\d{8}-[A-Z0-9]{6}$/);

      // ── ASSERT: status badge ──────────────────────────────────────────────
      await expect(firstRow.locator('span.badge')).toHaveText('PENDING');

      // ── ASSERT: total amount ──────────────────────────────────────────────
      await expect(firstRow).toContainText(`$${EXPECTED_TOTAL}.00`);

      // ── ASSERT: stats actualizadas ────────────────────────────────────────
      const totalAfter = await hotelPage.bookings.getStatValue('Total Bookings');
      expect(totalAfter).toBe('1');

      const pending = await hotelPage.bookings.getStatValue('Pending');
      expect(pending).toBe('1');

      const revenue = await hotelPage.bookings.getStatValue('Total Revenue');
      expect(revenue).toContain(`${EXPECTED_TOTAL}`);
    }
  );

  // ── TC-H-E2E-002 ──────────────────────────────────────────────────────────

  test('TC-H-E2E-002: full lifecycle PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT',
    async ({ hotelPage }) => {

      // ── ARRANGE: booking via API para no depender de TC-001 ──────────────
      const { confirmation_number } = await createBookingViaApi(hotelPage.getPage());

      await hotelPage.getPage().reload();
      await hotelPage.getPage().waitForLoadState('networkidle');
      await hotelPage.goToBookings();

      // Verificamos que el punto de partida es PENDING
      const initialStatus = await hotelPage.bookings.getBookingStatus(confirmation_number);
      expect(initialStatus).toBe('PENDING');

      // ── ACT + ASSERT: PENDING → CONFIRMED ────────────────────────────────
      await hotelPage.bookings.updateStatus(confirmation_number, 'CONFIRMED');

      await hotelPage.getPage().reload();
      await hotelPage.getPage().waitForLoadState('networkidle');
      await hotelPage.goToBookings();

      const confirmedStatus = await hotelPage.bookings.getBookingStatus(confirmation_number);
      expect(confirmedStatus).toBe('CONFIRMED');

      const confirmedStat = await hotelPage.bookings.getStatValue('Confirmed');
      expect(confirmedStat).toBe('1');

      // ── ACT + ASSERT: CONFIRMED → CHECKED_IN ─────────────────────────────
      await hotelPage.bookings.updateStatus(confirmation_number, 'CHECKED_IN');

      await hotelPage.getPage().reload();
      await hotelPage.getPage().waitForLoadState('networkidle');
      await hotelPage.goToBookings();

      const checkedInStatus = await hotelPage.bookings.getBookingStatus(confirmation_number);
      expect(checkedInStatus).toBe('CHECKED_IN');

      const checkedInStat = await hotelPage.bookings.getStatValue('Checked In');
      expect(checkedInStat).toBe('1');

      // ── ACT + ASSERT: CHECKED_IN → CHECKED_OUT ───────────────────────────
      await hotelPage.bookings.updateStatus(confirmation_number, 'CHECKED_OUT');

      await hotelPage.getPage().reload();
      await hotelPage.getPage().waitForLoadState('networkidle');
      await hotelPage.goToBookings();

      const checkedOutStatus = await hotelPage.bookings.getBookingStatus(confirmation_number);
      expect(checkedOutStatus).toBe('CHECKED_OUT');
    }
  );

  // ── TC-H-E2E-003 ──────────────────────────────────────────────────────────

  test('TC-H-E2E-003: cancellation requires reason field and updates badge',
    async ({ hotelPage }) => {

      // ── ARRANGE: booking via API ──────────────────────────────────────────
      const { confirmation_number } = await createBookingViaApi(hotelPage.getPage());

      await hotelPage.getPage().reload();
      await hotelPage.getPage().waitForLoadState('networkidle');
      await hotelPage.goToBookings();

      // ── ACT: abrir modal y seleccionar CANCELLED ──────────────────────────
      await hotelPage.bookings.openUpdateStatusModal(confirmation_number);
      await hotelPage.bookings.modalSelectNewStatus.selectOption('CANCELLED');

      // ── ASSERT: el campo de motivo aparece solo con CANCELLED ─────────────
      await expect(hotelPage.bookings.modalCancellationReasonGroup).toBeVisible();

      // ── ACT: rellenar motivo y confirmar ──────────────────────────────────
      await hotelPage.bookings.modalTextareaCancellationReason.fill(
        'Guest requested cancellation'
      );
      await hotelPage.bookings.modalUpdateStatusButton.click();
      await hotelPage.getPage().waitForLoadState('networkidle');

      // ── ASSERT: badge actualizado a CANCELLED ─────────────────────────────
      const status = await hotelPage.bookings.getBookingStatus(confirmation_number);
      expect(status).toBe('CANCELLED');

      // ── ASSERT: Pending baja a 0 ──────────────────────────────────────────
      const pending = await hotelPage.bookings.getStatValue('Pending');
      expect(pending).toBe('0');
    }
  );

  // ── TC-H-E2E-004 ──────────────────────────────────────────────────────────

  test('TC-H-E2E-004: review creation after CHECKED_OUT appears in reviews table',
    async ({ hotelPage }) => {

      // ── ARRANGE: booking llevada a CHECKED_OUT via API ────────────────────
      const { id, confirmation_number } = await createBookingViaApi(hotelPage.getPage());
      await driveToCheckedOut(hotelPage.getPage(), id);

      await hotelPage.getPage().reload();
      await hotelPage.getPage().waitForLoadState('networkidle');

      // ── ACT: ir a Reviews y verificar tabla vacía ─────────────────────────
      await hotelPage.goToReviews();
      const countBefore = await hotelPage.reviews.getReviewCount();
      expect(countBefore).toBe(0);

      // ── ACT: abrir modal, seleccionar booking y rellenar review ───────────
      await hotelPage.reviews.openAddReviewModal();

      // El dropdown debe contener la booking con estado CHECKED_OUT
      const bookingOption = hotelPage.reviews.selectBooking.locator('option', {
        hasText: GUEST.name,
      });
      await expect(bookingOption).toBeVisible();

      // Seleccionamos por texto parcial del guest name
      await hotelPage.reviews.selectBooking.selectOption({ label: new RegExp(GUEST.name) as unknown as string });
      await hotelPage.reviews.waitForVisible(hotelPage.reviews.reviewFormSection);

      // ── ACT: poner ratings y comentario ──────────────────────────────────
      await hotelPage.reviews.setOverallRating(5);
      await hotelPage.reviews.setCleanlinessRating(4);
      await hotelPage.reviews.setServiceRating(5);
      await hotelPage.reviews.setLocationRating(5);
      await hotelPage.reviews.setValueRating(4);
      await hotelPage.reviews.fillComment('Excellent stay, would recommend!');
      await hotelPage.reviews.submitReview();

      // ── ASSERT: review aparece en la tabla ────────────────────────────────
      const countAfter = await hotelPage.reviews.getReviewCount();
      expect(countAfter).toBe(1);

      const reviewRow = hotelPage.reviews.getReviewRow(GUEST.name);
      await expect(reviewRow).toBeVisible();
      await expect(reviewRow).toContainText('Grand Plaza Hotel');
      await expect(reviewRow).toContainText('Excellent stay, would recommend!');
    }
  );

  // ── TC-H-E2E-005 ──────────────────────────────────────────────────────────

  test('TC-H-E2E-005: review modal only shows CHECKED_OUT bookings',
    async ({ hotelPage }) => {

      // ── ARRANGE: dos bookings — una PENDING, una CHECKED_OUT ──────────────
      const pending = await createBookingViaApi(hotelPage.getPage());

      // Segunda booking: diferente guest para distinguirlas
      const baseUrl = process.env.QACLOUD_BASE_URL ?? '';
      const propertiesRes = await hotelPage.getPage().request.get(
        `${baseUrl}/api/hotel/properties`,
        { headers: apiHeaders() }
      );
      const properties = await propertiesRes.json();
      const property = properties.find((p: any) => p.name === 'Grand Plaza Hotel');

      const roomTypesRes = await hotelPage.getPage().request.get(
        `${baseUrl}/api/hotel/room-types`,
        { headers: apiHeaders() }
      );
      const roomTypes = await roomTypesRes.json();
      const roomType = roomTypes.find(
        (rt: any) => rt.property_id === property.id && rt.name === 'Standard Double Room'
      );

      const checkedOutRes = await hotelPage.getPage().request.post(
        `${baseUrl}/api/hotel/bookings`,
        {
          headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
          data: {
            property_id:    property.id,
            room_type_id:   roomType.id,
            guest_name:     'Checked Out Guest',
            guest_email:    'checkedout@qa.com',
            guest_phone:    '+9876543210',
            check_in_date:  CHECK_IN_DATE,
            check_out_date: CHECK_OUT_DATE,
            number_of_guests:     1,
          },
        }
      );
      const checkedOutBooking = await checkedOutRes.json();
      await driveToCheckedOut(hotelPage.getPage(), checkedOutBooking.id);

      await hotelPage.getPage().reload();
      await hotelPage.getPage().waitForLoadState('networkidle');

      // ── ACT: abrir modal de Add Review ────────────────────────────────────
      await hotelPage.goToReviews();
      await hotelPage.reviews.openAddReviewModal();

      // ── ASSERT: solo aparece la booking CHECKED_OUT ───────────────────────
      const options = hotelPage.reviews.selectBooking.locator('option');
      const optionTexts = await options.allTextContents();

      // Filtramos el placeholder vacío
      const realOptions = optionTexts.filter(t => t.trim() !== '' && !t.includes('--'));

      expect(realOptions.length).toBe(1);
      expect(realOptions[0]).toContain('Checked Out Guest');
      expect(realOptions.some(t => t.includes(GUEST.name))).toBe(false);

      await hotelPage.reviews.closeModal();
    }
  );

  // ── TC-H-E2E-006 ──────────────────────────────────────────────────────────

  test('TC-H-E2E-006: deleting a booking removes row and resets stats to zero',
    async ({ hotelPage }) => {

      // ── ARRANGE: booking via API ──────────────────────────────────────────
      const { confirmation_number } = await createBookingViaApi(hotelPage.getPage());

      await hotelPage.getPage().reload();
      await hotelPage.getPage().waitForLoadState('networkidle');
      await hotelPage.goToBookings();

      // Stats antes del delete
      const totalBefore = await hotelPage.bookings.getStatValue('Total Bookings');
      expect(totalBefore).toBe('1');

      // ── ACT: eliminar la booking ──────────────────────────────────────────
      await hotelPage.bookings.deleteBooking(confirmation_number);

      await hotelPage.getPage().waitForLoadState('networkidle');

      // ── ASSERT: tabla vacía ───────────────────────────────────────────────
      const bookingCount = await hotelPage.bookings.getBookingCount();
      expect(bookingCount).toBe(0);

      // ── ASSERT: stats reseteadas ──────────────────────────────────────────
      const totalAfter = await hotelPage.bookings.getStatValue('Total Bookings');
      expect(totalAfter).toBe('0');

      const revenue = await hotelPage.bookings.getStatValue('Total Revenue');
      expect(revenue).toContain('0');
    }
  );

});

// ── Helper: request context para llamadas API en beforeAll/afterAll ───────────

function apiHeaders() {
  return { Authorization: process.env.QACLOUD_API_KEY ?? '' };
}

// ── Helper: crea una booking via API y devuelve su ID y confirmation_number ──

async function createBookingViaApi(page: any): Promise<{ id: string; confirmation_number: string; property_id: string }> {
  const baseUrl = process.env.QACLOUD_BASE_URL ?? '';

  // 1. Obtener properties para sacar el ID de Grand Plaza Hotel
  const propertiesRes = await page.request.get(
    `${baseUrl}/api/hotel/properties`,
    { headers: apiHeaders() }
  );
  const properties = await propertiesRes.json();
  const property = properties.find((p: any) => p.name === 'Grand Plaza Hotel');

  // 2. Obtener room types para sacar el ID de Standard Double Room
  const roomTypesRes = await page.request.get(
    `${baseUrl}/api/hotel/room-types`,
    { headers: apiHeaders() }
  );
  const roomTypes = await roomTypesRes.json();
  const roomType = roomTypes.find(
    (rt: any) => rt.property_id === property.id && rt.name === 'Standard Double Room'
  );

  // 3. Crear la booking
  const bookingRes = await page.request.post(
    `${baseUrl}/api/hotel/bookings`,
    {
      headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
      data: {
        property_id:      property.id,
        room_type_id:     roomType.id,
        guest_name:       GUEST.name,
        guest_email:      GUEST.email,
        guest_phone:      GUEST.phone,
        check_in_date:    CHECK_IN_DATE,
        check_out_date:   CHECK_OUT_DATE,
        number_of_guests: 2,      
        number_of_rooms:  1,      
      },
    }
  );
  const booking = await bookingRes.json();
  console.log('STATUS:', bookingRes.status());
  console.log('BODY:', JSON.stringify(booking, null, 2));
  console.log('PROPERTY:', JSON.stringify(property, null, 2));
  console.log('ROOM TYPE:', JSON.stringify(roomType, null, 2));
  return {
    id:                  booking.id,
    confirmation_number: booking.confirmation_number,
    property_id:         property.id,
  };
}

// ── Helper: lleva una booking a CHECKED_OUT via API ──────────────────────────

async function driveToCheckedOut(page: any, bookingId: string): Promise<void> {
  const baseUrl = process.env.QACLOUD_BASE_URL ?? '';
  const url = `${baseUrl}/api/hotel/bookings/${bookingId}`;
  const headers = { ...apiHeaders(), 'Content-Type': 'application/json' };

  for (const status of ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']) {
    await page.request.put(url, { headers, data: { status } });
  }
}

// ── Helper: elimina todas las bookings via API (cleanup post-suite) ───────────

async function deleteAllBookings(page: any): Promise<void> {
  const baseUrl = process.env.QACLOUD_BASE_URL ?? '';
  const res = await page.request.get(
    `${baseUrl}/api/hotel/bookings`,
    { headers: apiHeaders() }
  );
  const bookings = await res.json();
  for (const booking of bookings) {
    await page.request.delete(
      `${baseUrl}/api/hotel/bookings/${booking.id}`,
      { headers: apiHeaders() }
    );
  }
}


