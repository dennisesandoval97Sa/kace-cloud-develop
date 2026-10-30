import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPendingReclassification } from './applyPendingReclassification.js';
import {
  clearReclassificationSession,
  hasReclassificationSession,
  markReclassificationSession,
} from './reclassificationSession.js';

const CASO = 'caso-1';
const CLAS_ACTUAL = 'clas-actual';
const CLAS_DESTINO = 'clas-otra';

let storeValues;
const reclassifyCase = vi.fn();
const handleErrorMessage = vi.fn((error) => error?.message ?? 'error');

const storeService = {
  get: (path) => storeValues[path],
  set: (path, value) => {
    storeValues[path] = value;
  },
};

const kaceEngine = {
  getService: (name) =>
    name === 'cases' ? { reclassifyCase, handleErrorMessage } : null,
};

const run = () => applyPendingReclassification({ kaceEngine, storeService });

describe('applyPendingReclassification (OS-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reclassifyCase.mockResolvedValue({ status: 200 });
    storeValues = {
      'cases.case_id': CASO,
      'cases.case_data': {
        id: CASO,
        clasificacion_id: CLAS_ACTUAL,
        updated_at: '2026-09-15T10:00:00Z',
        updated_by: 'user-1',
      },
      'classifications.reclassification_precheck': {
        case_id: CASO,
        clasificacion_id: CLAS_DESTINO,
      },
      'classifications.reclassification_reason': 'El cliente sí cerró',
      'states.current_transition': { transition_id: 'trans-nueva' },
    };
    markReclassificationSession(CASO, CLAS_DESTINO);
  });

  afterEach(() => {
    clearReclassificationSession();
  });

  it('reclasifica con la clasificación destino, la transición elegida y el motivo', async () => {
    const result = await run();

    expect(result).toEqual({ applied: true, reasonDiscarded: false });
    expect(reclassifyCase).toHaveBeenCalledWith({
      caseId: CASO,
      clasificacionId: CLAS_DESTINO,
      transicionId: 'trans-nueva',
      currentClasificacionId: CLAS_ACTUAL,
      motivo: 'El cliente sí cerró',
      updatedAt: '2026-09-15T10:00:00Z',
      updatedBy: 'user-1',
    });
    expect(hasReclassificationSession(CASO)).toBe(false);
  });

  it('no hace nada sin una reclasificación pendiente', async () => {
    storeValues['classifications.reclassification_precheck'] = null;

    expect(await run()).toEqual({ skipped: true });
    expect(reclassifyCase).not.toHaveBeenCalled();
  });

  it('no repite la reclasificación en un reintento del guardado', async () => {
    storeValues['classifications.reclassification_applied'] = {
      case_id: CASO,
      clasificacion_id: CLAS_DESTINO,
    };

    expect(await run()).toEqual({ skipped: true });
    // Repetirla duplicaría el comentario de motivo.
    expect(reclassifyCase).not.toHaveBeenCalled();
  });

  it('sí reclasifica si la marca es de otro destino', async () => {
    storeValues['classifications.reclassification_applied'] = {
      case_id: CASO,
      clasificacion_id: 'clas-tercera',
    };

    expect(await run()).toEqual({ applied: true, reasonDiscarded: false });
  });

  it('no hace nada si el caso ya está en la clasificación destino', async () => {
    storeValues['cases.case_data'].clasificacion_id = CLAS_DESTINO;

    expect(await run()).toEqual({ skipped: true });
    expect(reclassifyCase).not.toHaveBeenCalled();
  });

  it('falla si no se eligió un estado del flujo destino', async () => {
    storeValues['states.current_transition'] = null;

    const result = await run();

    expect(result.failed).toBe(true);
    expect(result.message).toMatch(/seleccionar un estado/i);
    expect(reclassifyCase).not.toHaveBeenCalled();
  });

  it('devuelve el mensaje del backend cuando el POST rechaza', async () => {
    reclassifyCase.mockRejectedValue(new Error('El caso fue modificado'));

    const result = await run();

    expect(result.failed).toBe(true);
    expect(result.message).toBe('El caso fue modificado');
  });

  it('falla sin reventar si el servicio no está disponible', async () => {
    const result = await applyPendingReclassification({
      kaceEngine: { getService: () => null },
      storeService,
    });

    expect(result.failed).toBe(true);
  });

  it('manda el motivo vacío cuando el asesor no escribió nada', async () => {
    storeValues['classifications.reclassification_reason'] = null;

    await run();

    expect(reclassifyCase).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: '' })
    );
  });

  /**
   * El motivo demasiado corto lo descarta `reclassifyCase` a propósito —mandarlo haría fallar el
   * POST entero—, pero el asesor tiene que enterarse: el aviso previo a confirmar es cosmético y
   * no impide guardar.
   */
  it('propaga que el motivo se descartó por ser demasiado corto', async () => {
    reclassifyCase.mockResolvedValue({
      response: { status: 200 },
      reasonDiscarded: true,
    });

    expect(await run()).toEqual({ applied: true, reasonDiscarded: true });
  });

  /**
   * El store vive en localStorage y sobrevive al cambio de caso, así que un precheck que no se
   * consuma queda ahí. Sin acotarlo por caso, el siguiente guardado —de OTRO caso, con otra
   * clasificación— lo tomaba por pendiente y reclasificaba el caso equivocado en silencio: el
   * snapshot de concurrencia que viaja en el POST es el del caso actual, así que el backend
   * tampoco lo frenaba.
   */
  describe('precheck acotado al caso', () => {
    it('descarta un precheck de otro caso sin reclasificar nada', async () => {
      storeValues['classifications.reclassification_precheck'] = {
        case_id: 'otro-caso',
        clasificacion_id: CLAS_DESTINO,
      };

      const result = await run();

      expect(result).toEqual({ skipped: true });
      expect(reclassifyCase).not.toHaveBeenCalled();
      expect(
        storeValues['classifications.reclassification_precheck']
      ).toBeNull();
    });

    it('descarta un precheck sin case_id, que solo puede venir de una sesión anterior', async () => {
      storeValues['classifications.reclassification_precheck'] = {
        clasificacion_id: CLAS_DESTINO,
      };

      const result = await run();

      expect(result).toEqual({ skipped: true });
      expect(reclassifyCase).not.toHaveBeenCalled();
      expect(
        storeValues['classifications.reclassification_precheck']
      ).toBeNull();
    });

    it('consume el precheck al aplicarlo, para que no llegue vivo al caso siguiente', async () => {
      const result = await run();

      expect(result).toEqual({ applied: true, reasonDiscarded: false });
      expect(
        storeValues['classifications.reclassification_precheck']
      ).toBeNull();
    });

    it('deja el precheck en su sitio si el POST falla, para poder reintentar', async () => {
      reclassifyCase.mockRejectedValue(new Error('timeout'));

      await run();

      expect(
        storeValues['classifications.reclassification_precheck']
      ).toMatchObject({ case_id: CASO, clasificacion_id: CLAS_DESTINO });
    });
  });
});
