/**
 * Integración Form.io → React (ver `OsSelect.formio.test.jsx` para el porqué y la
 * convención de sufijos `*.formio.test.*`).
 * Sin `entity` configurada, el componente pinta la rama de aviso, que mantiene
 * el mismo `<label>`; basta para comprobar la propagación de `validate.required`.
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

const SelectReferenceAuxiliariesComponent = (await import('./index.js'))
  .default;

/** @type {any} */
let instance = null;

async function mountFormioComponent(schemaOverrides = {}) {
  const schema = {
    ...SelectReferenceAuxiliariesComponent.schema(),
    key: 'ref_aux_field',
    label: 'Auxiliares de referencia',
    ...schemaOverrides,
  };

  instance = new SelectReferenceAuxiliariesComponent(
    schema,
    { language: 'es' },
    {}
  );

  const element = document.createElement('div');
  element.innerHTML = instance.render();
  document.body.appendChild(element);

  await act(async () => {
    await instance.attach(element);
  });

  return { instance, element };
}

describe('SelectReferenceAuxiliariesComponent (Form.io) — required-field asterisk', () => {
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
