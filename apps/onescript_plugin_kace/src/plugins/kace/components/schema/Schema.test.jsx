import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Schema } from './Schema.jsx';

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      if (name === 'storeService') return { get: vi.fn(), set: vi.fn() };
      return { getService: vi.fn() };
    },
  }),
}));

const attachFocusFormComponentMock = vi.fn();
const patchAlertSanitizerMock = vi.fn();
const showWebformErrorsMock = vi.fn();
vi.mock('#plugins/kace/shared/FocusFormComponent.js', () => ({
  attachFocusFormComponent: (...args) => attachFocusFormComponentMock(...args),
  patchAlertSanitizer: (...args) => patchAlertSanitizerMock(...args),
  showWebformErrors: (...args) => showWebformErrorsMock(...args),
}));

let formReadyCallback;
vi.mock('@formio/react', () => ({
  Form: (props) => {
    formReadyCallback = props.formReady;
    return null;
  },
}));

const mockUseSchema = vi.fn();
vi.mock('#plugins/kace/hooks/useSchema.js', () => ({
  default: (...args) => mockUseSchema(...args),
}));

const validateFormDataMock = vi.fn();

const baseUseSchemaResult = () => ({
  components: [{ type: 'textfield', key: 'campo1' }],
  formName: 'Formulario Auxiliar',
  submission: { data: {} },
  setSubmission: vi.fn(),
  handleChange: vi.fn(),
  error: null,
  validationSchema: { campo1: { type: 'string' } },
  validateFormData: validateFormDataMock,
  isLoading: false,
});

const makeWebformInstance = () => ({
  submission: { data: {} },
  data: {},
  setSubmission: vi.fn(),
  emit: vi.fn(),
  showErrors: vi.fn(),
  everyComponent: vi.fn(),
  getComponents: vi.fn(() => []),
  checkValidity: vi.fn(() => Promise.resolve(true)),
  getComponent: vi.fn(() => null),
  setAlert: vi.fn(),
});

describe('Schema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formReadyCallback = undefined;
    mockUseSchema.mockReturnValue(baseUseSchemaResult());
  });

  it('attaches focus navigation and alert sanitization on the Form.io instance once it is ready', async () => {
    const instance = makeWebformInstance();
    render(
      <Schema
        component={{ key: 'aux_cases' }}
        updateValue={vi.fn()}
        onEvent={vi.fn()}
        root={{}}
      />
    );

    await waitFor(() => expect(formReadyCallback).toBeInstanceOf(Function));
    act(() => formReadyCallback(instance));

    expect(attachFocusFormComponentMock).toHaveBeenCalledWith(instance);
    expect(patchAlertSanitizerMock).toHaveBeenCalledWith(instance);
  });

  it('shows an extra Joi error for a key that has no mounted component (unmatched details)', async () => {
    const instance = makeWebformInstance();
    instance.getComponent = vi.fn(() => null);
    validateFormDataMock.mockResolvedValue({
      valid: false,
      details: [{ path: ['no_montado'], message: '"no_montado" es requerido' }],
    });

    const handlers = {};
    const onEvent = vi.fn((event, handler) => {
      handlers[event] = handler;
    });

    render(
      <Schema
        component={{ key: 'aux_cases' }}
        updateValue={vi.fn()}
        onEvent={onEvent}
        root={{}}
      />
    );

    await waitFor(() => expect(formReadyCallback).toBeInstanceOf(Function));
    act(() => formReadyCallback(instance));

    await waitFor(() =>
      expect(handlers.submitButtonClicked).toBeInstanceOf(Function)
    );
    await handlers.submitButtonClicked();

    await waitFor(() =>
      expect(showWebformErrorsMock).toHaveBeenCalledWith(
        instance,
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('no_montado'),
          }),
        ])
      )
    );
  });

  it('falls back to validationResult.errors when there are no per-field details', async () => {
    const instance = makeWebformInstance();
    validateFormDataMock.mockResolvedValue({
      valid: false,
      errors: [{ path: 'campoX', message: 'campoX inválido' }],
    });

    const handlers = {};
    const onEvent = vi.fn((event, handler) => {
      handlers[event] = handler;
    });

    render(
      <Schema
        component={{ key: 'aux_cases' }}
        updateValue={vi.fn()}
        onEvent={onEvent}
        root={{}}
      />
    );

    await waitFor(() => expect(formReadyCallback).toBeInstanceOf(Function));
    act(() => formReadyCallback(instance));

    await waitFor(() =>
      expect(handlers.submitButtonClicked).toBeInstanceOf(Function)
    );
    await handlers.submitButtonClicked();

    await waitFor(() =>
      expect(showWebformErrorsMock).toHaveBeenCalledWith(
        instance,
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('campoX inválido'),
          }),
        ])
      )
    );
  });

  it('records the nested webform instance on the global root only once it has painted, clearing any stale pointer synchronously at handler start', async () => {
    const instance = makeWebformInstance();
    showWebformErrorsMock.mockImplementation((webform) => {
      webform.alert = 'painted';
    });
    let resolveValidation;
    validateFormDataMock.mockReturnValue(
      new Promise((resolve) => {
        resolveValidation = resolve;
      })
    );

    const root = { _nestedFormAlertInstance: { alert: 'stale' } };
    const handlers = {};
    const onEvent = vi.fn((event, handler) => {
      handlers[event] = handler;
    });

    render(
      <Schema
        component={{ key: 'aux_cases' }}
        updateValue={vi.fn()}
        onEvent={onEvent}
        root={root}
      />
    );

    await waitFor(() => expect(formReadyCallback).toBeInstanceOf(Function));
    act(() => formReadyCallback(instance));

    await waitFor(() =>
      expect(handlers.submitButtonClicked).toBeInstanceOf(Function)
    );

    const clickPromise = handlers.submitButtonClicked();
    // The stale pointer is cleared synchronously, before any awaited work.
    expect(root._nestedFormAlertInstance).toBeNull();

    // While Joi is still pending, the pointer must remain null — proving
    // it is not assigned before `showWebformErrors` has painted the alert.
    await waitFor(() =>
      expect(root._nestedFormValidationPromise).toBeDefined()
    );
    expect(root._nestedFormAlertInstance).toBeNull();

    resolveValidation({
      valid: false,
      errors: [{ path: 'campoX', message: 'campoX inválido' }],
    });
    await clickPromise;

    expect(root._nestedFormAlertInstance).toBe(instance);
    expect(instance.alert).toBe('painted');
  });
});

/**
 * Fuga de listeners: `schema/index.js` pasa `onEvent: this.on.bind(this)`, una función nueva en
 * cada `renderReactComponent()` (que `setDisabled` dispara en cada redibujado del formulario).
 * Sin `offEvent` cada redibujado deja otra suscripción viva sobre el mismo emisor compartido de
 * Form.io. El emisor real (`Element.on`/`off`) apila y da de baja por identidad.
 */
describe('Schema — suscripción a los eventos del componente', () => {
  beforeEach(() => {
    formReadyCallback = undefined;
    mockUseSchema.mockReturnValue(baseUseSchemaResult());
  });

  function createEmitter() {
    const registry = new Map();
    return {
      count: (name) => registry.get(name)?.length ?? 0,
      on: (name, handler) => {
        if (!registry.has(name)) registry.set(name, []);
        registry.get(name).push(handler);
      },
      off: (name, handler) => {
        const handlers = registry.get(name);
        if (!handlers) return;
        const index = handlers.indexOf(handler);
        if (index !== -1) handlers.splice(index, 1);
      },
    };
  }

  const baseProps = {
    component: { key: 'aux_cases' },
    updateValue: vi.fn(),
    root: {},
  };

  it('deja una sola suscripción por evento aunque el componente se redibuje (setDisabled)', async () => {
    const emitter = createEmitter();
    const { rerender } = render(
      <Schema
        {...baseProps}
        onEvent={(name, handler) => emitter.on(name, handler)}
        offEvent={(name, handler) => emitter.off(name, handler)}
      />
    );
    rerender(
      <Schema
        {...baseProps}
        onEvent={(name, handler) => emitter.on(name, handler)}
        offEvent={(name, handler) => emitter.off(name, handler)}
      />
    );
    rerender(
      <Schema
        {...baseProps}
        onEvent={(name, handler) => emitter.on(name, handler)}
        offEvent={(name, handler) => emitter.off(name, handler)}
      />
    );

    expect(emitter.count('submitButtonClicked')).toBe(1);
    expect(emitter.count('submitButtonConfirmed')).toBe(1);
  });

  it('se da de baja al desmontar, sin dejar nada colgando del emisor compartido', async () => {
    const emitter = createEmitter();
    const { unmount } = render(
      <Schema
        {...baseProps}
        onEvent={(name, handler) => emitter.on(name, handler)}
        offEvent={(name, handler) => emitter.off(name, handler)}
      />
    );
    await waitFor(() => expect(formReadyCallback).toBeInstanceOf(Function));

    unmount();

    expect(emitter.count('submitButtonClicked')).toBe(0);
    expect(emitter.count('submitButtonConfirmed')).toBe(0);
  });
});
