import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * OS-12 (MSKT-1392): al reclasificar cambia `one_script_form_id` y se re-resuelve el formulario.
 * Esto YA funcionaba; lo que faltaba era fijarlo con un test, porque la parte frágil es la guarda
 * anti-obsoletos: si la respuesta de la clasificación ANTERIOR llega tarde, no puede sobrescribir
 * el formulario de la nueva.
 */

const FORM_VIEJO = 'form-clasificacion-vieja';
const FORM_NUEVO = 'form-clasificacion-nueva';

const storeValues = {};
const getSchema = vi.fn();
const fetchAuxSchema = vi.fn();

vi.mock('../services/storeService', () => ({
  storeService: {
    get: (path) => storeValues[path],
    set: (path, value) => {
      storeValues[path] = value;
    },
  },
}));

const storeServiceMock = {
  get: (path) => storeValues[path],
  set: (path, value) => {
    storeValues[path] = value;
  },
};
const engineMock = {
  getService: (name) => {
    if (name === 'oneScript') return { getSchema };
    if (name === 'aux') return { fetchAuxSchema };
    if (name === 'storeService') return storeServiceMock;
    return null;
  },
};

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => engineMock,
}));

const UseSchema = (await import('./useSchema.js')).default;

/** Un componente reconocible por formulario, para saber cuál quedó montado. */
const schemaFor = (formId) => ({
  oneScriptData: { schema_id: `schema-${formId}`, name: formId },
  formSchema: [{ key: formId, type: 'textfield', label: formId }],
});

const renderWithForm = (oneScriptFormId) =>
  renderHook(
    ({ formId }) =>
      UseSchema({
        onEvent: null,
        root: null,
        updateValue: vi.fn(),
        component: { one_script_form_id: formId },
        initialData: {},
      }),
    { initialProps: { formId: oneScriptFormId } }
  );

describe('useSchema — re-resolución del formulario al reclasificar (OS-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(storeValues)) delete storeValues[key];
    fetchAuxSchema.mockResolvedValue({ data_structure: {} });
  });

  it('carga el formulario de la clasificación nueva al cambiar one_script_form_id', async () => {
    getSchema.mockImplementation(async ({ oneScriptFormId }) =>
      schemaFor(oneScriptFormId)
    );

    const { result, rerender } = renderWithForm(FORM_VIEJO);
    await waitFor(() =>
      expect(result.current.components[0]?.key).toBe(FORM_VIEJO)
    );

    rerender({ formId: FORM_NUEVO });

    await waitFor(() =>
      expect(result.current.components[0]?.key).toBe(FORM_NUEVO)
    );
  });

  it('una respuesta obsoleta no sobrescribe el formulario ya cargado', async () => {
    let resolverViejo;
    getSchema.mockImplementation(async ({ oneScriptFormId }) => {
      if (oneScriptFormId === FORM_VIEJO) {
        return new Promise((resolve) => {
          resolverViejo = () => resolve(schemaFor(FORM_VIEJO));
        });
      }
      return schemaFor(FORM_NUEVO);
    });

    const { result, rerender } = renderWithForm(FORM_VIEJO);
    // El asesor reclasifica antes de que la petición anterior vuelva.
    rerender({ formId: FORM_NUEVO });
    await waitFor(() =>
      expect(result.current.components[0]?.key).toBe(FORM_NUEVO)
    );

    resolverViejo();

    // Sin la guarda anti-obsoletos, aquí el formulario viejo pisaría al nuevo.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.components[0]?.key).toBe(FORM_NUEVO);
    expect(result.current.formName).toBe(FORM_NUEVO);
  });

  it('un fallo obsoleto tampoco borra el formulario ya cargado', async () => {
    let rechazarViejo;
    getSchema.mockImplementation(async ({ oneScriptFormId }) => {
      if (oneScriptFormId === FORM_VIEJO) {
        return new Promise((_resolve, reject) => {
          rechazarViejo = () => reject(new Error('Petición vieja falló'));
        });
      }
      return schemaFor(FORM_NUEVO);
    });

    const { result, rerender } = renderWithForm(FORM_VIEJO);
    rerender({ formId: FORM_NUEVO });
    await waitFor(() =>
      expect(result.current.components[0]?.key).toBe(FORM_NUEVO)
    );

    rechazarViejo();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.components[0]?.key).toBe(FORM_NUEVO);
    expect(result.current.error).toBeNull();
  });

  it('sin one_script_form_id deja de cargar en vez de quedarse colgado', async () => {
    const { result } = renderWithForm(null);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getSchema).not.toHaveBeenCalled();
  });
});
