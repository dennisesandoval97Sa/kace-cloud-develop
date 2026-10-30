import { describe, expect, it } from 'vitest';
import {
  isPrecheckAbandoned,
  isReclassificationReasonInvalid,
  isReclassificationUnlocked,
  isReclassifying,
} from './reclassificationPolicy.js';

const unlocked = {
  globalFlagEnabled: true,
  hasReclassifyPermission: true,
  caseHasClassification: true,
  caseIsClosed: false,
};

describe('isReclassificationUnlocked', () => {
  it('desbloquea con el flag del tenant Y el permiso de rol sobre un caso clasificado y abierto', () => {
    expect(isReclassificationUnlocked(unlocked)).toBe(true);
  });

  it('no desbloquea sin el flag del tenant, aunque el rol tenga el permiso', () => {
    expect(
      isReclassificationUnlocked({ ...unlocked, globalFlagEnabled: false })
    ).toBe(false);
  });

  /**
   * BUG-4 (reporte de agente 2026-09-21): el commit 0f985f95e dejó el gate dependiendo
   * SOLO del flag global. La reclasificación debe permitirse solo si AMBOS checks están
   * habilitados: el flag global Y el permiso de rol `CaseReclassify` del agente.
   */
  it('no desbloquea sin el permiso de rol CaseReclassify, aunque el flag global esté activo', () => {
    expect(
      isReclassificationUnlocked({
        ...unlocked,
        hasReclassifyPermission: false,
      })
    ).toBe(false);
  });

  it('no desbloquea en creación, donde el desplegable ya está abierto', () => {
    expect(
      isReclassificationUnlocked({ ...unlocked, caseHasClassification: false })
    ).toBe(false);
  });

  it('no desbloquea un caso cerrado, que el backend rechazaría', () => {
    expect(
      isReclassificationUnlocked({ ...unlocked, caseIsClosed: true })
    ).toBe(false);
  });

  it.each([undefined, null, 'true', 1, {}])(
    'trata %p como flag no resuelto y deja bloqueado',
    (value) => {
      expect(
        isReclassificationUnlocked({ ...unlocked, globalFlagEnabled: value })
      ).toBe(false);
    }
  );

  it.each([undefined, null, 'true', 1, {}])(
    'trata %p como permiso no resuelto y deja bloqueado',
    (value) => {
      expect(
        isReclassificationUnlocked({
          ...unlocked,
          hasReclassifyPermission: value,
        })
      ).toBe(false);
    }
  );
});

const reclassifying = {
  reclassifyUnlocked: true,
  selectedClasificacionId: 'clas-otra',
  caseClasificacionId: 'clas-actual',
};

describe('isReclassifying', () => {
  it('detecta una clasificación distinta de la del caso', () => {
    expect(isReclassifying(reclassifying)).toBe(true);
  });

  it('no aplica con el gate bloqueado', () => {
    expect(
      isReclassifying({ ...reclassifying, reclassifyUnlocked: false })
    ).toBe(false);
  });

  it('no aplica al volver a la clasificación original', () => {
    expect(
      isReclassifying({
        ...reclassifying,
        selectedClasificacionId: 'clas-actual',
      })
    ).toBe(false);
  });

  it('compara como texto, sin importar el tipo del id', () => {
    expect(
      isReclassifying({
        ...reclassifying,
        selectedClasificacionId: 7,
        caseClasificacionId: '7',
      })
    ).toBe(false);
  });

  it.each([undefined, null, ''])(
    'no aplica sin selección (%p): el asesor está a mitad de los niveles',
    (value) => {
      expect(
        isReclassifying({ ...reclassifying, selectedClasificacionId: value })
      ).toBe(false);
    }
  );

  it.each([undefined, null, ''])(
    'no aplica sobre un caso sin clasificar (%p), que es creación',
    (value) => {
      expect(
        isReclassifying({ ...reclassifying, caseClasificacionId: value })
      ).toBe(false);
    }
  );
});

describe('isReclassificationReasonInvalid', () => {
  it.each(['', '   ', undefined, null])(
    'marca el motivo vacío (%p): es obligatorio',
    (value) => {
      expect(isReclassificationReasonInvalid(value)).toBe(true);
    }
  );

  it.each(['a', 'ab', ' ab '])(
    'marca %p, que el backend rechazaría por min(3)',
    (value) => {
      expect(isReclassificationReasonInvalid(value)).toBe(true);
    }
  );

  it('acepta desde tres caracteres', () => {
    expect(isReclassificationReasonInvalid('abc')).toBe(false);
  });
});

describe('isPrecheckAbandoned', () => {
  const abandoned = {
    precheck: { case_id: 'caso-1', clasificacion_id: 'clas-destino' },
    caseId: 'caso-1',
    caseClasificacionId: 'clas-origen',
    hasLiveReclassification: false,
  };

  it('detecta el precheck de este caso que quedó vivo sin guardarse', () => {
    expect(isPrecheckAbandoned(abandoned)).toBe(true);
  });

  it('no toca el precheck mientras la reclasificación sigue viva en esta sesión', () => {
    expect(
      isPrecheckAbandoned({ ...abandoned, hasLiveReclassification: true })
    ).toBe(false);
  });

  it('no toca el precheck de otro caso: no le corresponde decidir sobre él', () => {
    expect(isPrecheckAbandoned({ ...abandoned, caseId: 'caso-2' })).toBe(false);
  });

  it('no toca un precheck ya aplicado, pendiente del guardado auxiliar', () => {
    expect(
      isPrecheckAbandoned({ ...abandoned, caseClasificacionId: 'clas-destino' })
    ).toBe(false);
  });

  it.each([null, undefined, {}, { case_id: 'caso-1' }])(
    'no hace nada sin un destino que comparar (%p)',
    (precheck) => {
      expect(isPrecheckAbandoned({ ...abandoned, precheck })).toBe(false);
    }
  );

  it.each([null, undefined, ''])(
    'no decide sin la clasificación del caso (%p): todavía no se ha resuelto',
    (value) => {
      expect(
        isPrecheckAbandoned({ ...abandoned, caseClasificacionId: value })
      ).toBe(false);
    }
  );

  it.each([null, undefined, ''])('no decide sin caso abierto (%p)', (value) => {
    expect(isPrecheckAbandoned({ ...abandoned, caseId: value })).toBe(false);
  });

  it('compara por valor, no por tipo: el store puede devolver ids numéricos', () => {
    expect(
      isPrecheckAbandoned({
        ...abandoned,
        precheck: { case_id: 7, clasificacion_id: 'clas-destino' },
        caseId: '7',
      })
    ).toBe(true);
  });
});
