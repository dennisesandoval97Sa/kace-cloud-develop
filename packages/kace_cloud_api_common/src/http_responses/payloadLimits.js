// Límite duro del runtime de Lambda para la respuesta serializada completa (bytes).
// Es el número exacto del error "Exceeded maximum allowed payload size (6291556 bytes)".
export const LAMBDA_MAX_RESPONSE_BYTES = 6_291_556;

// Corte del guard sobre el payload serializado real ({statusCode, headers, body}). Por debajo del
// límite duro para dejar un pequeño margen final. Por encima → 413 controlado.
export const MAX_SAFE_RESPONSE_BYTES = 6_200_000;

// Si el body crudo es menor a esto, el payload no puede alcanzar el límite ni con escapado al 100%
// (peor caso ~2×), así que se omite la medición precisa (evita un stringify extra en respuestas chicas).
export const PRECISE_CHECK_FLOOR_BYTES = 3_000_000;
