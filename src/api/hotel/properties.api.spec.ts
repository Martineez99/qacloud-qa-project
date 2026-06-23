// ┌─────────────────────────────────────────────────────────────────┐
// │  properties.api.spec.ts                                         │
// │  CRUD de properties: GET, POST, PUT (partial), DELETE, cascade  │
// │                                                                 │
// │  Cubre: TC-H-API-PROP-001 a TC-H-API-PROP-008                  │
// └─────────────────────────────────────────────────────────────────┘

import { test, expect } from '../../fixtures/api.fixture';
import { epic, feature, story, severity, tag } from 'allure-js-commons';

test.describe('Hotel Properties API', () => {

  test.describe.configure({ mode: 'serial' }); // todos en orden, 1 worker

  // Reset completo antes de cada test.
  // hotelReset() restaura las 5 seed properties + 14 room types
  // y vacía bookings y reviews — estado determinista garantizado.
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.hotelReset();
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-PROP-001 — GET all properties after reset returns 5 seed items
  // ════════════════════════════════════════════════════════════════
  test('GET /api/hotel/properties returns 200 with 5 seed properties', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Property Management');
    await story('List properties');
    await severity('critical');
    await tag('hotel');
    await tag( 'properties');
    await tag('smoke');

    // ACT
    const properties = await apiClient.getProperties();

    // ASSERT
    expect(properties.length).toBe(5);

    // Verificamos que la estructura básica de cada property es correcta
    for (const property of properties) {
      expect(property.id).toBeTruthy();
      expect(property.name).toBeTruthy();
      expect(property.city).toBeTruthy();
      expect(property.country).toBeTruthy();
    }
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-PROP-002 — GET property by ID returns the correct one
  // ════════════════════════════════════════════════════════════════
  test('GET /api/hotel/properties/:id returns 200 with the correct property', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Property Management');
    await story('Get property by ID');
    await severity('normal');
    await tag('hotel'); 
    await tag('properties');


    // ARRANGE — usamos la primera seed property para tener un ID real
    const properties = await apiClient.getProperties();
    const target = properties[0];

    // ACT
    const property = await apiClient.getPropertyById(target.id);

    // ASSERT
    expect(property.id).toBe(target.id);
    expect(property.name).toBe(target.name);
    expect(property.city).toBe(target.city);
    expect(property.country).toBe(target.country);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-PROP-003 — GET non-existent property returns 404
  // ════════════════════════════════════════════════════════════════
  test('GET /api/hotel/properties/:id returns 404 for non-existent ID', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Property Management');
    await story('Get property by ID');
    await severity('normal');
    await tag('hotel'); 
    await tag('properties');
    await tag('negative');

    // ACT — UUID sintácticamente válido pero que no pertenece a este usuario
    const response = await apiClient.get('/api/hotel/properties/00000000-0000-0000-0000-000000000000');

    // ASSERT
    expect(response.status).toBe(404);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-PROP-004 — POST with required fields only returns 201
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/properties creates property and returns 201', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Property Management');
    await story('Create property');
    await severity('critical');
    await tag('hotel'); 
    await tag('properties');
    await tag('smoke');

    // ACT
    const property = await apiClient.createProperty({
      name:    'Test Hotel Barcelona',
      city:    'Barcelona',
      country: 'Spain',
      address: 'Carrer de Mallorca, 401',
    });

    // ASSERT — campos requeridos presentes en la respuesta
    expect(property.id).toBeTruthy();
    expect(property.name).toBe('Test Hotel Barcelona');
    expect(property.city).toBe('Barcelona');
    expect(property.country).toBe('Spain');
    expect(property.address).toBe('Carrer de Mallorca, 401');

    // La nueva property debe aparecer en el listado (6 en total)
    const allProperties = await apiClient.getProperties();
    expect(allProperties.length).toBe(6);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-PROP-005 — POST missing required field returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/hotel/properties returns 400 when required field is missing', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Property Management');
    await story('Create property');
    await severity('normal');
    await tag('hotel'); 
    await tag('properties');
    await tag('negative');
    await tag('validation');

    // ACT — falta el campo `name`, que es obligatorio
    const response = await apiClient.post('/api/hotel/properties', {
      data: {
        city:    'Madrid',
        country: 'Spain',
        address: 'Gran Vía, 1',
        // name: omitido intencionalmente
      },
    });

    // ASSERT
    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-PROP-006 — PUT partial update changes only the sent field
  // ════════════════════════════════════════════════════════════════
  test('PUT /api/hotel/properties/:id partial update changes only the sent field', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Property Management');
    await story('Update property');
    await severity('normal');
    await tag('hotel'); 
    await tag('properties');
    await tag('edge-case');

    // ARRANGE — creamos una property con datos controlados
    const created = await apiClient.createProperty({
      name:    'Original Name Hotel',
      city:    'Valencia',
      country: 'Spain',
      address: 'Av. del Port, 1',
    });

    // ACT — actualizamos solo la ciudad
    const updated = await apiClient.updateProperty(created.id, {
      city: 'Alicante',
    });

    // ASSERT — solo city cambió, el resto permanece intacto
    expect(updated.city).toBe('Alicante');
    expect(updated.name).toBe('Original Name Hotel');    // sin cambios
    expect(updated.country).toBe('Spain');               // sin cambios
    expect(updated.address).toBe('Av. del Port, 1');     // sin cambios
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-PROP-007 — DELETE property then GET returns 404
  // ════════════════════════════════════════════════════════════════
  test('DELETE /api/hotel/properties/:id removes property and GET returns 404', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Property Management');
    await story('Delete property');
    await severity('critical');
    await tag('hotel'); 
    await tag('properties');

    // ARRANGE — creamos una property para borrarla (no tocamos las 5 seed)
    const created = await apiClient.createProperty({
      name:    'Hotel to Delete',
      city:    'Sevilla',
      country: 'Spain',
      address: 'Calle Sierpes, 10',
    });

    // ACT — borrar la property
    await apiClient.deleteProperty(created.id);

    // ASSERT — ya no existe
    const response = await apiClient.get(`/api/hotel/properties/${created.id}`);
    expect(response.status).toBe(404);

    // Y el total vuelve a ser 5 (las seed)
    const allProperties = await apiClient.getProperties();
    expect(allProperties.length).toBe(5);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-H-API-PROP-008 — DELETE property cascades to its room types
  // ════════════════════════════════════════════════════════════════
  test('DELETE /api/hotel/properties/:id cascades and removes its room types', async ({ apiClient }) => {
    await epic('Hotel App');
    await feature('Property Management');
    await story('Delete property cascade');
    await severity('critical');
    await tag('hotel'); 
    await tag('properties');
    await tag('cascade');
    await tag('edge-case');

    // ARRANGE — creamos una property nueva y le añadimos un room type
    const property = await apiClient.createProperty({
      name:    'Cascade Test Hotel',
      city:    'Bilbao',
      country: 'Spain',
      address: 'Gran Vía Don Diego López de Haro, 87',
    });

    const roomType = await apiClient.createRoomType({
      property_id:    property.id,
      name:           'Cascade Test Room',
      bed_type:       'King',
      max_occupancy:  2,
      price_per_night: 150,
      total_rooms:    5,
    });

    // Verificar que el room type existe antes del borrado
    const roomTypeBefore = await apiClient.getRoomTypeById(roomType.id);
    expect(roomTypeBefore.id).toBe(roomType.id);

    // ACT — borrar la property
    await apiClient.deleteProperty(property.id);

    // ASSERT — el room type ya no existe (cascade delete)
    const response = await apiClient.get(`/api/hotel/room-types/${roomType.id}`);
    expect(response.status).toBe(404);
  });

});
