/**
 * Integración: recorre el camino real Form.io → React.
 *
 * En vez de renderizar `<OsSelect>` a mano (lo que hace `OsSelect.test.jsx`),
 * este test instancia la clase de componente Form.io (`OsSelectComponent`),
 * la monta con `attach()` sobre un DOM y verifica que el `<label>` que Form.io
 * termina pintando lleva la clase `field-required` cuando el schema del builder
 * define `validate.required`. Así se cubre la propagación
 * `this.component.validate.required` → prop `component` → `<OsSelect>`.
 *
 * Convención de sufijos de test en este plugin:
 *   *.test.{jsx,js}        → unit del componente React aislado (@testing-library/react)
 *   *.formio.test.{jsx,js} → integración con la clase Form.io real (new ComponentClass(...).attach())
 */
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const _stableKaceEngineInstance = {
  getService: (name) =>
    name === 'storeService'
      ? { get: () => 'http://localhost' }
      : { get: vi.fn(), post: vi.fn() },
};
vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => _stableKaceEngineInstance,
}));

vi.mock('#plugins/kace/hooks/useDynamicSelect.js', () => ({
  default: () => ({
    states: {
      options: [],
      loading: false,
      error: null,
      selectedValue: '',
      isInternalChange: { current: false },
    },
    actions: { setSelectedValue: vi.fn() },
    ensureLoaded: vi.fn(),
    resetCache: vi.fn(),
    onExternalDataEvent: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

const OsSelectComponent = (await import('./index.js')).default;

/** @type {any} */
let instance = null;

/**
 * Monta el componente Form.io standalone y devuelve su elemento raíz ya adjunto.
 * @param {Record<string, unknown>} [schemaOverrides]
 */
async function mountFormioComponent(schemaOverrides = {}) {
  const schema = {
    ...OsSelectComponent.schema(),
    key: 'os_select_field',
    label: 'Dynamic Select',
    ...schemaOverrides,
  };

  instance = new OsSelectComponent(schema, { language: 'es' }, {});

  const element = document.createElement('div');
  element.innerHTML = instance.render();
  document.body.appendChild(element);

  await act(async () => {
    await instance.attach(element);
  });

  return { instance, element };
}

describe('OsSelectComponent (Form.io) — required-field asterisk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(async () => {
    await act(async () => {
      instance?.destroy();
    });
    instance = null;
  });

  it('propaga validate.required del schema hasta la clase field-required del label', async () => {
    const { element } = await mountFormioComponent({
      validate: { required: true },
    });

    await waitFor(() => {
      const reactLabel = element.querySelector('label.font-weight-medium');
      expect(reactLabel).not.toBeNull();
      expect(reactLabel.classList.contains('field-required')).toBe(true);
    });
  });

  it('no marca field-required cuando el schema no exige el campo', async () => {
    const { element } = await mountFormioComponent({
      validate: { required: false },
    });

    await waitFor(() => {
      const reactLabel = element.querySelector('label.font-weight-medium');
      expect(reactLabel).not.toBeNull();
      expect(reactLabel.classList.contains('field-required')).toBe(false);
    });
  });

  it('no marca field-required con el schema por defecto del builder (sin override de validate)', async () => {
    const { element } = await mountFormioComponent();

    await waitFor(() => {
      const reactLabel = element.querySelector('label.font-weight-medium');
      expect(reactLabel).not.toBeNull();
      expect(reactLabel.classList.contains('field-required')).toBe(false);
    });
  });
});
