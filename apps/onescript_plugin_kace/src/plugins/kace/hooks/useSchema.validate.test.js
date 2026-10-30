import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => ({ getService: () => null }),
}));

vi.mock('../services/storeService', () => ({
  storeService: { get: () => null, set: () => {} },
}));

const UseSchema = (await import('./useSchema.js')).default;

/** `data_structure` del schema de la clasificación nueva. */
const dataStructure = {
  nombre: { type: 'string', required: true },
  monto: { type: 'number' },
};

function renderValidate() {
  const { result } = renderHook(() =>
    UseSchema({
      onEvent: null,
      root: null,
      updateValue: vi.fn(),
      component: {},
      initialData: {},
    })
  );
  return result.current.validateFormData;
}

describe('useSchema.validateFormData — llaves de una clasificación anterior', () => {
  let validateFormData;

  beforeEach(() => {
    validateFormData = renderValidate();
  });

  it('acepta un payload con llaves huérfanas, como hace el backend', async () => {
    const result = await validateFormData(dataStructure, {
      nombre: 'Caso',
      monto: 10,
      motivo_no_venta: 'sobrevive de la clasificación anterior',
      canal_previo: 'telefonico',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('un formulario sin huérfanas valida exactamente igual que hoy', async () => {
    const ok = await validateFormData(dataStructure, {
      nombre: 'Caso',
      monto: 10,
    });
    expect(ok.valid).toBe(true);

    const ko = await validateFormData(dataStructure, { monto: 10 });
    expect(ko.valid).toBe(false);
    expect(ko.errors.map((e) => e.path)).toContain('nombre');
  });

  it('descartar huérfanas no tapa un fallo del schema vigente', async () => {
    const result = await validateFormData(dataStructure, {
      monto: 10,
      motivo_no_venta: 'previo',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.path)).toContain('nombre');
  });

  it('sin data_structure no valida nada', async () => {
    await expect(validateFormData(null, { lo_que_sea: 1 })).resolves.toEqual({
      valid: true,
      errors: [],
    });
  });
});
