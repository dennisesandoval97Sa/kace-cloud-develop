import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomSelect } from './CustomSelect.jsx';

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      if (name === 'storeService') {
        return { get: () => 'http://localhost' };
      }
      return { get: vi.fn(), post: vi.fn() };
    },
  }),
}));

vi.mock('formiojs', () => ({
  Utils: {
    evaluate: vi.fn(() => undefined),
  },
}));

describe('CustomSelect remote search focus', () => {
  it('keeps search input focus after loading finishes when remoteSearch and segmented', async () => {
    const user = userEvent.setup();
    const updateValue = vi.fn();
    const onEvent = vi.fn();
    const { rerender } = render(
      <CustomSelect
        component={{
          key: 'c1',
          code: '',
          infiniteScroll: false,
          remoteSearch: true,
          refetchOnEveryOpen: false,
        }}
        value=""
        data={{}}
        updateValue={updateValue}
        onEvent={onEvent}
        root={{}}
        disabled={false}
      />
    );
    await user.click(screen.getByText('Elige una opción'));
    const input = screen.getByPlaceholderText('Escriba para buscar...');
    await user.click(input);
    expect(document.activeElement).toBe(input);
    rerender(
      <CustomSelect
        component={{
          key: 'c1',
          code: '',
          infiniteScroll: false,
          remoteSearch: true,
          refetchOnEveryOpen: false,
        }}
        value=""
        data={{}}
        updateValue={updateValue}
        onEvent={onEvent}
        root={{}}
        disabled={false}
      />
    );
    expect(document.activeElement).toBe(input);
  });
});

/**
 * Fuga de listeners (code review MSKT-1392): `index.js` pasa `onEvent: this.on.bind(this)`, una
 * función nueva en cada `renderReactComponent()` —que `setDisabled()` dispara en cada redibujado
 * del formulario—. Sin `offEvent` cada redibujado deja otra suscripción viva sobre el mismo
 * emisor compartido. El emisor real (`Element.on`/`off`) apila y da de baja por identidad — un
 * doble que solo indexa por nombre no vería el problema.
 */
describe('CustomSelect — suscripción a los eventos del componente', () => {
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
    component: { key: 'cEvt', code: '' },
    value: '',
    data: {},
    updateValue: vi.fn(),
    root: {},
    onEvent: (name, handler) => emitter.on(name, handler),
    offEvent: (name, handler) => emitter.off(name, handler),
  });

  it('deja una sola suscripción por evento aunque el componente se redibuje (setDisabled)', () => {
    const emitter = createEmitter();
    const { rerender } = render(<CustomSelect {...propsWith(emitter)} />);
    rerender(<CustomSelect {...propsWith(emitter)} />);
    rerender(<CustomSelect {...propsWith(emitter)} />);

    expect(emitter.count('kaceAuthData')).toBe(1);
    expect(emitter.count('redraw')).toBe(1);
    expect(emitter.count('resetForm')).toBe(1);
  });

  it('se da de baja al desmontar, sin dejar nada colgando del emisor compartido', () => {
    const emitter = createEmitter();
    const { unmount } = render(<CustomSelect {...propsWith(emitter)} />);

    unmount();

    expect(emitter.count('kaceAuthData')).toBe(0);
    expect(emitter.count('redraw')).toBe(0);
    expect(emitter.count('resetForm')).toBe(0);
  });
});
