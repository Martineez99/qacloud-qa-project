// ┌─────────────────────────────────────────────────────────────────┐
// │  hotel.types.ts                                                 │
// │  Interfaces que modelan los recursos de la Hotel API            │
// │                                                                 │
// │  IMPORTANTE: los nombres de campo siguen la convención          │
// │  snake_case de la API REST de qacloud.dev. No camelCase.        │
// │  Así los tests pueden hacer assertions directas contra el body  │
// │  parseado sin transformaciones intermedias.                     │
// └─────────────────────────────────────────────────────────────────┘

// ── Tipos auxiliares ──────────────────────────────────────────────

export type BedType = 'Single' | 'Double' | 'Queen' | 'King' | 'Twin';

/**
 * Estados válidos de una booking.
 * El lifecycle es: PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT
 * Desde cualquier estado se puede ir a CANCELLED (requiere reason) o NO_SHOW.
 */
export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

// ── Recursos principales ──────────────────────────────────────────

export interface Property {
  id: string;
  name: string;
  city: string;
  country: string;
  address: string;
  star_rating?: number;
  postal_code?: string;
  phone?: string;
  email?: string;
  check_in_time?: string;
  check_out_time?: string;
  description?: string;
  cancellation_policy?: string;
}

export interface RoomType {
  id: string;
  property_id: string;
  name: string;
  bed_type: BedType;
  max_occupancy: number;
  price_per_night: number;
  total_rooms: number;
  room_size?: number;
  description?: string;
  amenities?: string;
}

export interface Booking {
  id: string;
  confirmation_number: string;
  property_id: string;
  room_type_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  num_rooms: number;
  total_amount: number;
  status: BookingStatus;
  special_requests?: string;
  cancellation_reason?: string;
  created_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  property_id: string;
  overall_rating: number;
  cleanliness_rating?: number;
  service_rating?: number;
  location_rating?: number;
  value_rating?: number;
  comment?: string;
  created_at: string;
}

// ── Payloads de request ───────────────────────────────────────────

export interface CreatePropertyPayload {
  name: string;
  city: string;
  country: string;
  address: string;
  star_rating?: number;
  postal_code?: string;
  phone?: string;
  email?: string;
  check_in_time?: string;
  check_out_time?: string;
  description?: string;
  cancellation_policy?: string;
}

export interface CreateRoomTypePayload {
  property_id: string;
  name: string;
  bed_type: BedType;
  max_occupancy: number;
  price_per_night: number;
  total_rooms: number;
  room_size?: number;
  description?: string;
  amenities?: string;
}

export interface CreateBookingPayload {
  property_id: string;
  room_type_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  num_rooms?: number;
  special_requests?: string;
}

export interface UpdateBookingPayload {
  status: BookingStatus;
  cancellation_reason?: string;
}

export interface CreateReviewPayload {
  booking_id: string;
  property_id: string;
  overall_rating: number;
  cleanliness_rating?: number;
  service_rating?: number;
  location_rating?: number;
  value_rating?: number;
  comment?: string;
}
