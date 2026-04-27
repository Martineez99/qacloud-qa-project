// ┌─────────────────────────────────────────────────────────────────┐
// │  common.types.ts                                                │
// │  Tipos compartidos por toda la suite de tests                   │
// └─────────────────────────────────────────────────────────────────┘

/**
 * Envuelve TODAS las respuestas de la API en un tipo unificado.
 * El genérico <T> representa el tipo del body (varía por endpoint).
 *
 * ¿Por qué no usar directamente el APIResponse de Playwright?
 * Porque el APIResponse de Playwright es async en todo: .json(), .status(),
 * .headers()... lo que obliga a await en cada acceso. Nuestro tipo ya
 * resuelve todo eso, por lo que en el test accedes a response.status
 * directamente (sin await).
 */
export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string>;
  ok: boolean;         // true si status está entre 200-299
}

/**
 * Opciones que puedes pasar en cualquier llamada HTTP.
 *
 * - params: query string (?page=1&limit=10)
 * - data:   body del request (POST/PUT/PATCH)
 * - headers: headers adicionales que se MEZCLAN con los defaults
 * - failOnStatusCode: si true, el test falla automáticamente si status >= 400
 *                     Por defecto false — queremos validar errores intencionalmente
 */
export interface RequestOptions {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
  headers?: Record<string, string>;
  failOnStatusCode?: boolean;
}

/**
 * Estructura de error cuando la API devuelve un 4xx o 5xx.
 * Útil para validar mensajes de error en tests negativos.
 */
export interface ApiError {
  message: string;
  code?: string | number;
  details?: unknown;
}

/**
 * Respuestas paginadas — muchos endpoints de qacloud las usan.
 * El genérico <T> es el tipo de cada item de la lista.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}