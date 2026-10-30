import { describe, expect, it } from 'vitest';
import {
  attachAuxiliaryReclassificationComment,
  assertAuxiliaryReclassificationReason,
  ensureAuxiliaryReclassificationTransition,
  hasAuxiliaryReclassificationIntent,
} from './attachAuxiliaryReclassificationComment.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('attachAuxiliaryReclassificationComment', () => {
  it('is not an intent when current_* is missing', () => {
    expect(hasAuxiliaryReclassificationIntent({ clasificacion_id: C })).toBe(
      false
    );
  });

  it('is not an intent when destino equals current_*', () => {
    expect(
      hasAuxiliaryReclassificationIntent({
        clasificacion_id: A,
        current_clasificacion_id: A,
      })
    ).toBe(false);
  });

  it('leaves the envelope untouched without intent', () => {
    const envelope = { case: { clasificacion_id: A }, aux_cases: {} };
    expect(
      attachAuxiliaryReclassificationComment(envelope, 'motivo largo')
    ).toEqual(envelope);
  });

  it('copies the reason into comment.descripcion when there is intent', () => {
    const envelope = {
      case: { clasificacion_id: C, current_clasificacion_id: A },
      aux_cases: {},
    };
    expect(
      attachAuxiliaryReclassificationComment(
        envelope,
        '  Cambio de tipología  '
      )
    ).toEqual({
      ...envelope,
      comment: { descripcion: 'Cambio de tipología' },
    });
    expect(envelope.comment).toBeUndefined();
  });

  it('blocks save when intent exists and the reason is too short', () => {
    const envelope = {
      case: { clasificacion_id: C, current_clasificacion_id: A },
      aux_cases: {},
    };
    expect(() => assertAuxiliaryReclassificationReason(envelope, 'ab')).toThrow(
      /motivo de la reclasificación/i
    );
  });

  it('does not block when there is no intent, even with an empty reason', () => {
    expect(() =>
      assertAuxiliaryReclassificationReason(
        { case: { clasificacion_id: A }, aux_cases: {} },
        ''
      )
    ).not.toThrow();
  });

  it('puts transicion_id back after a dirty recorte when there is intent', () => {
    const envelope = {
      case: { clasificacion_id: C, current_clasificacion_id: A },
      comment: { descripcion: 'Cambio de tipología' },
    };
    expect(
      ensureAuxiliaryReclassificationTransition(envelope, {
        live: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      }).case.transicion_id
    ).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  });

  it('throws when intent exists and no transition fallback is available', () => {
    expect(() =>
      ensureAuxiliaryReclassificationTransition({
        case: { clasificacion_id: C, current_clasificacion_id: A },
        comment: { descripcion: 'Cambio de tipología' },
      })
    ).toThrow(/estado para reclasificar/i);
  });
});
