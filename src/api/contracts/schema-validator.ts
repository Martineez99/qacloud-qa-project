// ┌─────────────────────────────────────────────────────────────────┐
// │  schema-validator.ts                                            │
// │  Instancia AJV compartida + helper de validación               │
// └─────────────────────────────────────────────────────────────────┘

import Ajv from 'ajv';

/**
 * Instancia AJV configurada para todos los contract tests.
 *
 * allErrors: true  → reporta TODOS los errores de un schema, no solo el primero.
 *                    Útil para detectar múltiples campos rotos en una sola ejecución.
 * strict: false    → desactiva warnings de modo estricto sobre palabras clave
 *                    desconocidas (ej: 'additionalProperties' en subschemas).
 */
export const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * Valida `data` contra `schema` usando AJV.
 * Si la validación falla, lanza un Error con el listado completo de violaciones,
 * incluyendo el path del campo y la regla que se incumplió.
 *
 * @param schema  - JSON Schema como objeto JS
 * @param data    - El body de la respuesta API a validar
 * @param label   - Etiqueta para el mensaje de error (ej: 'GET /api/groceries')
 *
 * @example
 * validateSchema(productSchema, responseBody, 'POST /api/groceries');
 * // → si `price` es string en vez de number:
 * // [Contract] POST /api/groceries schema violations:
 * //   data/price must be number
 */
export function validateSchema(
  schema: object,
  data: unknown,
  label: string,
): void {
  const validate = ajv.compile(schema);
  const valid    = validate(data);

  if (!valid) {
    const errors = ajv.errorsText(validate.errors, {
      separator: '\n  ',
      dataVar:   'data',
    });
    throw new Error(`[Contract] ${label} schema violations:\n  ${errors}`);
  }
}