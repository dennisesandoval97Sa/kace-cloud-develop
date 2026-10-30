import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class FakeFormioComponent {
  constructor(component) {
    this.component = component || {};
    this.error = null;
  }
  emit() {}
  on() {}
  off() {}
}

vi.mock('@formio/react', () => ({
  Components: { components: { button: FakeFormioComponent } },
}));

vi.mock('#util/BuilderPlaceholder.jsx', () => ({
  BuilderPlaceholder: () => null,
}));

vi.mock('./Submit.jsx', () => ({
  Submit: () => null,
}));

vi.mock('./custom.form.json', () => ({ default: { components: [] } }));

vi.mock('#plugins/kace/shared/postMessageToParent.util.js', () => ({
  postMessageToParent: vi.fn(),
}));

vi.mock('../../shared/showStaleWarnings', () => ({
  showStaleWarnings: vi.fn(),
}));

const showWebformErrorsMock = vi.fn();
vi.mock('#plugins/kace/shared/FocusFormComponent.js', async () => {
  const actual = await vi.importActual(
    '#plugins/kace/shared/FocusFormComponent.js'
  );
  return {
    ...actual,
    // Spy that also runs the real implementation, so tests exercise the
    // actual sanitization/focus wiring instead of a tautological stub.
    showWebformErrors: (...args) => {
      showWebformErrorsMock(...args);
      return actual.showWebformErrors(...args);
    },
  };
});

const swalFireMock = vi.fn(() => Promise.resolve());
const swalCloseMock = vi.fn();
vi.mock('sweetalert2', () => ({
  default: {
    fire: (...args) => swalFireMock(...args),
    close: (...args) => swalCloseMock(...args),
  },
}));

const getServiceMock = vi.fn();
vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => ({ getService: getServiceMock }),
}));

let SubmitComponent;

beforeEach(async () => {
  vi.clearAllMocks();
  getServiceMock.mockImplementation((name) => {
    if (name === 'user') return { canEditCaseSync: () => true };
    if (name === 'storeService') return { get: () => false, set: vi.fn() };
    return {};
  });
  ({ default: SubmitComponent } = await import('./index.js'));
});

const makeComponent = ({ root }) => {
  const instance = new SubmitComponent({ id: 'submit1', label: 'Guardar' });
  instance.root = root;
  instance.element = document.createElement('div');
  return instance;
};

describe('SubmitComponent.beforeSubmit — invalid form', () => {
  it('shows the native error list and skips the Swal when root.alert is painted', async () => {
    const root = {
      data: {},
      submission: { data: { case_data: { clasificacion_id: 'x' } } },
      checkValidity: vi.fn(() => Promise.resolve(false)),
      setAlert: vi.fn(function (type, message) {
        this.alert = message;
      }),
      // Mirrors what the real Webform.showErrors does: paint through setAlert.
      showErrors: vi.fn(function () {
        this.setAlert(
          'danger',
          '<img src=x onerror=alert(1)>Corrige los errores'
        );
      }),
      alert: null,
    };

    const instance = makeComponent({ root });
    const result = await instance.beforeSubmit();

    expect(result).toBe(false);
    expect(showWebformErrorsMock).toHaveBeenCalledWith(root, null);
    expect(typeof root.focusOnComponent).toBe('function');
    expect(root.alert).not.toContain('onerror');
    expect(root.alert).toContain('Corrige los errores');
    expect(swalFireMock).not.toHaveBeenCalled();
  });

  it('falls back to the Swal when the native alert did not paint anything', async () => {
    const root = {
      data: {},
      submission: { data: { case_data: { clasificacion_id: 'x' } } },
      checkValidity: vi.fn(() => Promise.resolve(false)),
      alert: null,
    };

    const instance = makeComponent({ root });
    const result = await instance.beforeSubmit();

    expect(result).toBe(false);
    expect(showWebformErrorsMock).toHaveBeenCalledWith(root, null);
    expect(swalFireMock).toHaveBeenCalledTimes(1);
    expect(swalFireMock.mock.calls[0][0]).toMatchObject({
      title: 'Validación fallida',
    });
  });

  it('does not leak the submit button warning into the error list', async () => {
    const root = {
      data: {},
      submission: { data: { case_data: { clasificacion_id: 'x' } } },
      checkValidity: vi.fn(() => Promise.resolve(false)),
      alert: { node: true },
    };
    let errorDuringCall = 'unset';
    showWebformErrorsMock.mockImplementation(() => {
      errorDuringCall = instance.error;
    });

    const instance = makeComponent({ root });
    await instance.beforeSubmit();

    expect(errorDuringCall).toBeNull();
    expect(instance.error).not.toBeNull();
    expect(instance.error.level).toBe('warning');
  });

  it('does not leak a previous attempt warning into the error list on a second, still-invalid Guardar', async () => {
    const root = {
      data: {},
      submission: { data: { case_data: { clasificacion_id: 'x' } } },
      checkValidity: vi.fn(() => Promise.resolve(false)),
      alert: { node: true },
    };
    const errorsDuringCalls = [];
    showWebformErrorsMock.mockImplementation(() => {
      errorsDuringCalls.push(instance.error);
    });

    const instance = makeComponent({ root });
    await instance.beforeSubmit();
    await instance.beforeSubmit();

    expect(errorsDuringCalls).toEqual([null, null]);
    expect(instance.error.external).toBe(true);
  });
});

describe('SubmitComponent.beforeSubmit — nested aux-cases validation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeNestedRoot = ({ nestedAlertInstance }) => ({
    data: {},
    submission: { data: { case_data: { clasificacion_id: 'x' } } },
    checkValidity: vi.fn(() => Promise.resolve(true)),
    globalRoot: {
      alert: null,
      _nestedFormValidationResult: { valid: false },
      _nestedFormAlertInstance: nestedAlertInstance,
    },
  });

  it('skips the Swal when the nested schema form already painted its own error list, and closes the loading Swal', async () => {
    const root = makeNestedRoot({ nestedAlertInstance: { alert: 'painted' } });
    const instance = makeComponent({ root });

    const resultPromise = instance.beforeSubmit();
    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(result).toBe(false);
    expect(swalFireMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error de validación' })
    );
    expect(swalCloseMock).toHaveBeenCalled();
  });

  it('treats a disconnected alert node as not painted (stale pointer from a torn-down instance)', async () => {
    const disconnectedNode = { isConnected: false };
    const root = makeNestedRoot({
      nestedAlertInstance: { alert: disconnectedNode },
    });
    const instance = makeComponent({ root });

    const resultPromise = instance.beforeSubmit();
    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(result).toBe(false);
    expect(swalFireMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error de validación' })
    );
  });

  it('reads _nestedFormAlertInstance only after the validation promise settles, not before (no premature snapshot)', async () => {
    const globalRoot = { alert: null, _nestedFormAlertInstance: null };
    let resolveValidation;
    globalRoot._nestedFormValidationPromise = new Promise((resolve) => {
      resolveValidation = resolve;
    });
    const root = {
      data: {},
      submission: { data: { case_data: { clasificacion_id: 'x' } } },
      checkValidity: vi.fn(() => Promise.resolve(true)),
      globalRoot,
    };
    const instance = makeComponent({ root });

    const resultPromise = instance.beforeSubmit();
    // Let waitForAuxCases settle while Joi validation is still pending —
    // at this point _nestedFormAlertInstance is still null.
    await vi.advanceTimersByTimeAsync(1000);

    // Schema paints and records the instance only now, once validation
    // actually finishes (simulating Joi taking longer than the aux-cases wait).
    globalRoot._nestedFormAlertInstance = { alert: 'painted' };
    resolveValidation({ valid: false });

    const result = await resultPromise;

    expect(result).toBe(false);
    expect(swalFireMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error de validación' })
    );
    expect(swalCloseMock).toHaveBeenCalled();
  });

  it('falls back to the Swal when neither the root nor the nested form painted anything', async () => {
    const root = makeNestedRoot({ nestedAlertInstance: null });
    const instance = makeComponent({ root });

    const resultPromise = instance.beforeSubmit();
    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(result).toBe(false);
    expect(swalFireMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error de validación' })
    );
    expect(swalCloseMock).toHaveBeenCalled();
  });
});
