import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  RECLASSIFICATION_REASON_MAX_LENGTH,
  RECLASSIFICATION_REASON_MIN_LENGTH,
} from './reclassification.constants.js';

/**
 * Contrato con el backend, no preferencia del plugin: el mínimo del motivo lo fija el esquema Joi
 * de `POST /cases/{id}/reclassify`, y aquí solo se duplicaba en un comentario. Si el backend lo
 * cambia, esto tiene que fallar en CI y no descubrirse porque a un asesor se le descarte el motivo
 * en silencio.
 *
 * Se lee el archivo del Lambda en vez de importarlo: el esquema arrastra `joi` y `@kace/api-common`
 * —y con ellos medio SDK de AWS— a un test de jsdom que no los necesita para nada.
 */
const SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../apiv1/kace_cloud_api_case_reclassify/src/schemas.mjs'
);

/** `descripcion: Joi.string().min(3).max(5000).required()` */
const DESCRIPCION_RULE =
  /descripcion:\s*Joi\.string\(\)\.min\((\d+)\)\.max\((\d+)\)/;

describe('reclassification reason length contract', () => {
  const source = readFileSync(SCHEMA_PATH, 'utf8');
  const match = source.match(DESCRIPCION_RULE);

  it('finds the backend rule it is meant to mirror', () => {
    // Si esto falla, el esquema cambió de forma y el contrato dejó de comprobarse: hay que
    // actualizar el test, no borrarlo.
    expect(match).not.toBeNull();
  });

  it('mirrors the backend minimum length', () => {
    expect(RECLASSIFICATION_REASON_MIN_LENGTH).toBe(Number(match[1]));
  });

  it('never lets the form accept more than the backend does', () => {
    expect(RECLASSIFICATION_REASON_MAX_LENGTH).toBeLessThanOrEqual(
      Number(match[2])
    );
  });
});
