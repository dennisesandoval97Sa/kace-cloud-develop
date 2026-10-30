import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OsSelect } from './OsSelect.jsx';

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

const renderComponent = (component) =>
  render(
    <OsSelect
      component={component}
      value=""
      updateValue={vi.fn()}
      onEvent={vi.fn()}
    />
  );

describe('OsSelect required-field asterisk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the label as required when component.validate.required is true', () => {
    renderComponent({
      key: 'os1',
      label: 'Literal',
      validate: { required: true },
    });
    expect(screen.getByText('Literal')).toHaveClass('field-required');
  });

  it('does not mark the label as required when validate.required is falsy', () => {
    renderComponent({ key: 'os2', label: 'Literal' });
    expect(screen.getByText('Literal')).not.toHaveClass('field-required');
  });
});

/**
 * Fuga de listeners (code review MSKT-1392): `index.js` pasa `onEvent: this.on.bind(this)`, una
 * función nueva en cada `renderReactComponent()` —que `setDisabled()` dispara en cada redibujado
 * del formulario—. Sin `offEvent` cada redibujado deja otra suscripción viva sobre el mismo
 * emisor compartido. El emisor real (`Element.on`/`off`) apila y da de baja por identidad — un
 * doble que solo indexa por nombre no vería el problema.
 */
describe('OsSelect — suscripción a los eventos del componente', () => {
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

  const propsWith = (emitter) => ({
    component: { key: 'osEvt', label: 'Literal' },
    value: '',
    updateValue: vi.fn(),
    onEvent: (name, handler) => emitter.on(name, handler),
    offEvent: (name, handler) => emitter.off(name, handler),
  });

  it('deja una sola suscripción por evento aunque el componente se redibuje (setDisabled)', () => {
    const emitter = createEmitter();
    const { rerender } = render(<OsSelect {...propsWith(emitter)} />);
    rerender(<OsSelect {...propsWith(emitter)} />);
    rerender(<OsSelect {...propsWith(emitter)} />);

    expect(emitter.count('kaceAuthData')).toBe(1);
    expect(emitter.count('redraw')).toBe(1);
    expect(emitter.count('resetForm')).toBe(1);
  });

  it('se da de baja al desmontar, sin dejar nada colgando del emisor compartido', () => {
    const emitter = createEmitter();
    const { unmount } = render(<OsSelect {...propsWith(emitter)} />);

    unmount();

    expect(emitter.count('kaceAuthData')).toBe(0);
    expect(emitter.count('redraw')).toBe(0);
    expect(emitter.count('resetForm')).toBe(0);
  });
});
