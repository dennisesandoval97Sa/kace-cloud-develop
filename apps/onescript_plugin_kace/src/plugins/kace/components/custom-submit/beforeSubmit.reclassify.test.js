import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * MSKT-1392: el motivo de la reclasificación viaja en el POST auxiliary. `beforeSubmit` ya no
 * llama a `applyPendingReclassification`. Sigue abortando si el formulario no es válido o el
 * caso no es editable.
 *
 * Se invoca el método sobre un `this` falso en vez de construir el componente Form.io: el arnés
 * completo sería frágil y no aporta nada a lo que se quiere verificar.
 */

const applyPendingReclassification = vi.fn();
const evaluateKace = vi.fn();
const ensureCanEditCase = vi.fn().mockResolvedValue(false);

vi.mock('#plugins/kace/shared/applyPendingReclassification.js', () => ({
  applyPendingReclassification,
}));
vi.mock('#plugins/kace/shared/evaluateKace.js', () => ({ evaluateKace }));
vi.mock('#plugins/kace/shared/ensureCanEditCase.js', () => ({
  ensureCanEditCase,
}));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('#plugins/kace/shared/KaceData.js', () => ({ default: {} }));
vi.mock('#plugins/kace/shared/postMessageToParent.util.js', () => ({
  postMessageToParent: vi.fn(),
}));
vi.mock('#plugins/kace/utils/createFormComponentRedrawFns.js', () => ({
  createFormComponentRedrawFns: () => ({
    redrawComponent: vi.fn(),
    redrawComponents: vi.fn(),
    redrawAll: vi.fn(),
    getComponent: vi.fn(),
  }),
}));

const storeValues = {};
const storeServiceMock = {
  get: (path) => storeValues[path],
  set: (path, value) => {
    storeValues[path] = value;
  },
  clear: vi.fn(),
};

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      if (name === 'storeService') return storeServiceMock;
      if (name === 'file') return { uploadPendingAttachments: vi.fn() };
      if (name === 'cases') return { finishTimerAfterSubmit: vi.fn() };
      if (name === 'apiService') return {};
      return null;
    },
  }),
}));

const CustomSubmitComponent = (await import('./index.js')).default;

/** `this` mínimo para `beforeSubmit`: solo lo que el método toca. */
function makeThis() {
  const button = document.createElement('button');
  const element = document.createElement('div');
  element.appendChild(button);

  return {
    element,
    component: { customDefaultValue: 'noop();' },
    data: {},
    root: {
      data: {},
      submission: { data: { case_data: {} } },
      emit: vi.fn(),
      checkValidity: vi.fn().mockResolvedValue(true),
    },
    emit: vi.fn(),
    error: null,
    _emitSubmitButtonState: vi.fn(),
    _isTimerPaused: () => false,
  };
}

const runBeforeSubmit = (ctx) =>
  CustomSubmitComponent.prototype.beforeSubmit.call(ctx);

describe('CustomSubmit.beforeSubmit — sin POST dedicado de reclasificación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(storeValues)) delete storeValues[key];
    ensureCanEditCase.mockResolvedValue(false);
  });

  it('no llama applyPendingReclassification en el guardado', async () => {
    const ctx = makeThis();
    await runBeforeSubmit(ctx);
    expect(applyPendingReclassification).not.toHaveBeenCalled();
    expect(evaluateKace).toHaveBeenCalledTimes(1);
    expect(ctx.error).toBeNull();
  });

  it('sigue abortando si la validación del formulario no pasa', async () => {
    const ctx = makeThis();
    ctx.root.checkValidity.mockResolvedValue(false);
    const result = await runBeforeSubmit(ctx);
    expect(result).toBe(false);
    expect(applyPendingReclassification).not.toHaveBeenCalled();
  });

  it('sigue abortando si el caso no es editable', async () => {
    ensureCanEditCase.mockResolvedValue(true);
    const ctx = makeThis();
    const result = await runBeforeSubmit(ctx);
    expect(result).toBe(false);
    expect(evaluateKace).not.toHaveBeenCalled();
  });
});
