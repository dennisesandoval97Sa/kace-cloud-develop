import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearReclassificationSession } from '#plugins/kace/shared/reclassificationSession.js';

/**
 * La orquestación de la reclasificación se prueba sin montar `Classifications`: ese era el punto
 * de extraerla. Aquí se fijan las decisiones —qué se guarda, qué se descarta y cuándo— y no el
 * render.
 */
const PRECHECK_PATH = 'classifications.reclassification_precheck';
const REASON_PATH = 'classifications.reclassification_reason';
const CASO = 'caso-1';
const CLAS_ACTUAL = 'clas-actual';
const CLAS_DESTINO = 'clas-destino';

let storeValues;
const storeSet = vi.fn((path, value) => {
  storeValues[path] = value;
});
vi.mock('#plugins/kace/services/storeService.js', () => ({
  storeService: {
    get: (path) => storeValues[path],
    set: (path, value) => storeSet(path, value),
  },
}));

const { useReclassificationWorkflow } =
  await import('./useReclassificationWorkflow.js');

const precheckOk = {
  eligible: true,
  blocker: null,
  states: [{ transition: { id: 'trans-1' } }],
  transitionRules: [],
};

const deferred = () => {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const fetchReclassificationPrecheck = vi.fn();
const handleErrorMessage = vi.fn((error) => error?.message ?? 'error');
const emitEvent = vi.fn();

const caseRow = { id: CASO, clasificacion_id: CLAS_ACTUAL };
const tree = [{ clasificacion_id: CLAS_ACTUAL, nivel1: 'Origen' }];

const setup = (overrides = {}) => {
  const onRestoreSelection = vi.fn();
  const userChangedClassificationRef = { current: false };
  const resolveSelectionFor = vi.fn(() => ({ nivel1: 'Origen' }));

  const view = renderHook((props) => useReclassificationWorkflow(props), {
    initialProps: {
      caseService: { fetchReclassificationPrecheck, handleErrorMessage },
      emitEvent,
      caseId: CASO,
      caseData: caseRow,
      caseContextResolved: true,
      reclassifying: false,
      caseDataRef: { current: caseRow },
      optionsRef: { current: tree },
      userChangedClassificationRef,
      onRestoreSelection,
      resolveSelectionFor,
      ...overrides,
    },
  });

  return { ...view, onRestoreSelection, userChangedClassificationRef };
};

describe('useReclassificationWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeValues = {};
    clearReclassificationSession();
    fetchReclassificationPrecheck.mockResolvedValue(precheckOk);
  });

  afterEach(() => {
    clearReclassificationSession();
  });

  describe('confirmar el destino', () => {
    it('guarda el precheck acotado al caso y anuncia el flujo destino', async () => {
      const { result } = setup();

      await act(async () => {
        await result.current.confirmReclassification({
          clasificacion_id: CLAS_DESTINO,
          flujo_id: 'flujo-2',
        });
      });

      expect(storeValues[PRECHECK_PATH]).toMatchObject({
        case_id: CASO,
        clasificacion_id: CLAS_DESTINO,
      });
      expect(emitEvent).toHaveBeenCalledWith(
        'kaceCaseReclassified',
        expect.objectContaining({
          clasificacion_id: CLAS_DESTINO,
          flujo_id: 'flujo-2',
        })
      );
      expect(result.current.confirmedClasificacionId).toBe(CLAS_DESTINO);
    });

    it('no confirma nada cuando el backend rechaza el destino', async () => {
      fetchReclassificationPrecheck.mockResolvedValue({
        eligible: false,
        blocker: { message: 'El padre no declara esa clasificación' },
        states: [],
        transitionRules: [],
      });
      const { result } = setup();

      await act(async () => {
        await result.current.confirmReclassification({
          clasificacion_id: CLAS_DESTINO,
        });
      });

      expect(result.current.confirmedClasificacionId).toBeNull();
      expect(result.current.precheckBlockerMessage).toBe(
        'El padre no declara esa clasificación'
      );
      expect(storeValues[PRECHECK_PATH]).toBeUndefined();
      expect(emitEvent).not.toHaveBeenCalled();
    });

    it('muestra en español el bloqueo que el backend manda por código', async () => {
      fetchReclassificationPrecheck.mockResolvedValue({
        eligible: false,
        blocker: {
          code: '0x030058',
          message:
            'The target classification is not available for the case group.',
        },
        states: [],
        transitionRules: [],
      });
      const { result } = setup();

      await act(async () => {
        await result.current.confirmReclassification({
          clasificacion_id: CLAS_DESTINO,
        });
      });

      expect(result.current.precheckBlockerMessage).toBe(
        'La clasificación seleccionada no está disponible para el grupo del caso.'
      );
    });

    it('descarta la respuesta de un precheck que ya no describe la selección viva', async () => {
      const vieja = deferred();
      fetchReclassificationPrecheck
        .mockReturnValueOnce(vieja.promise)
        .mockResolvedValueOnce(precheckOk);
      const { result } = setup();

      let primera;
      act(() => {
        primera = result.current.confirmReclassification({
          clasificacion_id: 'clas-abandonada',
        });
      });

      // El asesor se mueve a otra rama con el precheck en vuelo.
      act(() => {
        result.current.abandonCurrentTarget();
      });

      await act(async () => {
        vieja.resolve(precheckOk);
        await primera;
      });

      expect(result.current.confirmedClasificacionId).toBeNull();
      expect(storeValues[PRECHECK_PATH]).toBeNull();
      expect(emitEvent).not.toHaveBeenCalled();
    });

    it('no publica el error de un precheck abandonado', async () => {
      const vieja = deferred();
      fetchReclassificationPrecheck.mockReturnValueOnce(
        vieja.promise.then(() => {
          throw new Error('fallo de red');
        })
      );
      const { result } = setup();

      let primera;
      act(() => {
        primera = result.current.confirmReclassification({
          clasificacion_id: 'clas-abandonada',
        });
      });
      act(() => {
        result.current.abandonCurrentTarget();
      });

      await act(async () => {
        vieja.resolve();
        await primera;
      });

      expect(result.current.precheckBlockerMessage).toBe('');
      expect(result.current.isCheckingPrecheck).toBe(false);
    });
  });

  describe('abandonar el destino al cambiar de rama', () => {
    it('borra el precheck GUARDADO, no solo el estado local', async () => {
      const { result } = setup();

      await act(async () => {
        await result.current.confirmReclassification({
          clasificacion_id: CLAS_DESTINO,
        });
      });
      act(() => {
        result.current.abandonCurrentTarget();
      });

      // Dejarlo vivo reclasificaría al destino que el asesor acaba de abandonar.
      expect(storeValues[PRECHECK_PATH]).toBeNull();
      expect(result.current.confirmedClasificacionId).toBeNull();
      expect(result.current.reclassificationReason).toBe('');
    });
  });

  describe('cancelar', () => {
    it('restaura la selección del caso y devuelve el mando a la re-sincronización', () => {
      const { result, onRestoreSelection, userChangedClassificationRef } =
        setup();
      userChangedClassificationRef.current = true;

      act(() => {
        result.current.cancelReclassification();
      });

      expect(onRestoreSelection).toHaveBeenCalledWith(
        { nivel1: 'Origen' },
        tree
      );
      expect(userChangedClassificationRef.current).toBe(false);
      expect(storeValues[PRECHECK_PATH]).toBeNull();
    });

    it('descarta la respuesta de un precheck que seguía en vuelo al cancelar', async () => {
      const vuelo = deferred();
      fetchReclassificationPrecheck.mockReturnValueOnce(vuelo.promise);
      const { result } = setup();

      let enVuelo;
      act(() => {
        enVuelo = result.current.confirmReclassification({
          clasificacion_id: CLAS_DESTINO,
        });
      });
      act(() => {
        result.current.cancelReclassification();
      });

      await act(async () => {
        vuelo.resolve(precheckOk);
        await enVuelo;
      });

      // Aplicarla reclasificaría a un destino que el asesor acaba de retirar de la pantalla.
      expect(result.current.confirmedClasificacionId).toBeNull();
      expect(storeValues[PRECHECK_PATH]).toBeNull();
      expect(emitEvent).not.toHaveBeenCalled();
      expect(result.current.isCheckingPrecheck).toBe(false);
    });

    it('no toca la selección cuando la clasificación del caso no está en el árbol', () => {
      const { result, onRestoreSelection } = setup({
        resolveSelectionFor: () => ({}),
      });

      act(() => {
        result.current.cancelReclassification();
      });

      expect(onRestoreSelection).not.toHaveBeenCalled();
    });
  });

  describe('motivo', () => {
    it('lo escribe en el store al salir del campo', () => {
      const { result } = setup({ reclassifying: true });

      act(() => {
        result.current.persistReason('  Venta confirmada  ');
      });

      expect(storeValues[REASON_PATH]).toBe('Venta confirmada');
    });

    it('lo borra en cuanto se deja de reclasificar', () => {
      const { rerender } = setup({ reclassifying: true });
      storeValues[REASON_PATH] = 'algo';

      rerender({
        caseService: { fetchReclassificationPrecheck, handleErrorMessage },
        emitEvent,
        caseId: CASO,
        caseData: caseRow,
        caseContextResolved: true,
        reclassifying: false,
        caseDataRef: { current: caseRow },
        optionsRef: { current: tree },
        userChangedClassificationRef: { current: false },
        onRestoreSelection: vi.fn(),
        resolveSelectionFor: vi.fn(() => ({})),
      });

      expect(storeValues[REASON_PATH]).toBeNull();
    });

    /**
     * BUG (reporte 2026-09-22, Andrés): un debounce de 400ms escribía el motivo al store con
     * retraso. OS-11 puede leerlo antes de que se asiente —comprobado con reclasificaciones
     * hechas una detrás de otra, con segundos de diferencia entre el tecleo y "Guardar"— y la
     * reclasificación quedaba escrita SIN motivo pese a que el asesor sí escribió uno. Ahora se
     * escribe sin demora en cuanto cambia el texto, sin depender de `onBlur` ni de una pausa.
     */
    it('escribe el motivo en el store en cuanto cambia, sin demora', () => {
      const { result } = setup({ reclassifying: true });

      act(() => {
        result.current.setReclassificationReason('Venta confirmada');
      });

      expect(storeValues[REASON_PATH]).toBe('Venta confirmada');
    });

    /**
     * Tras confirmar, el formulario destino se recarga y este hook se monta de nuevo.
     * confirmedClasificacionId y userChangedClassificationRef nacen vacíos, y en el
     * primer paint `reclassifying` todavía es false (la hoja no resolvió). Sin la
     * sesión en memoria el efecto de abandono borra el motivo: el POST sale sin
     * comment y el timeline pinta "No reason recorded".
     */
    it('tras un remount en el destino conserva el motivo y el precheck', async () => {
      const first = setup({ reclassifying: true });

      act(() => {
        first.result.current.setReclassificationReason('Venta confirmada');
      });
      await act(async () => {
        await first.result.current.confirmReclassification({
          clasificacion_id: CLAS_DESTINO,
        });
      });
      first.unmount();

      const remounted = setup({ reclassifying: false });

      expect(storeValues[PRECHECK_PATH]).toMatchObject({
        clasificacion_id: CLAS_DESTINO,
      });
      expect(storeValues[REASON_PATH]).toBe('Venta confirmada');
      expect(remounted.result.current.reclassificationReason).toBe(
        'Venta confirmada'
      );
      expect(remounted.result.current.confirmedClasificacionId).toBe(
        CLAS_DESTINO
      );
    });
  });

  describe('precheck confirmado y abandonado sin guardar', () => {
    /**
     * Es el bug H1: el marcador sobrevive en localStorage y, al reabrir el caso, bloquea TODOS
     * los guardados posteriores con un error que no tiene que ver con lo que el asesor hizo.
     */
    it('lo limpia al resincronizar con un caso que ya no está reclasificándose', () => {
      storeValues[PRECHECK_PATH] = {
        case_id: CASO,
        clasificacion_id: CLAS_DESTINO,
      };
      storeValues[REASON_PATH] = 'un motivo viejo';

      setup();

      expect(storeValues[PRECHECK_PATH]).toBeNull();
      expect(storeValues[REASON_PATH]).toBeNull();
    });

    it('no toca un precheck vivo de esta misma sesión', async () => {
      const { result } = setup();

      await act(async () => {
        await result.current.confirmReclassification({
          clasificacion_id: CLAS_DESTINO,
        });
      });

      expect(storeValues[PRECHECK_PATH]).toMatchObject({
        clasificacion_id: CLAS_DESTINO,
      });
    });

    it('espera a que el caso se resuelva antes de decidir', () => {
      storeValues[PRECHECK_PATH] = {
        case_id: CASO,
        clasificacion_id: CLAS_DESTINO,
      };

      setup({ caseContextResolved: false, caseData: null });

      expect(storeValues[PRECHECK_PATH]).not.toBeNull();
    });
  });
});
