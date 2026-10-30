import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import { Multiselect } from './Multiselect.jsx';

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

vi.mock('#plugins/kace/shared/evaluateKace.js', () => ({
  evaluateKace: vi.fn(),
}));

describe('Multiselect segmented infinite scroll', () => {
  beforeEach(() => {
    vi.mocked(evaluateKace).mockReset();
  });

  it('shows default placeholder when component placeholder is missing or blank', () => {
    const { rerender } = render(
      <Multiselect
        component={{ key: 'mPh', code: 'x' }}
        values={[]}
        data={{}}
        updateValue={vi.fn()}
        onEvent={vi.fn()}
      />
    );
    expect(screen.getByText('Seleccione una opción')).toBeInTheDocument();
    rerender(
      <Multiselect
        component={{ key: 'mPh', code: 'x', placeholder: '   ' }}
        values={[]}
        data={{}}
        updateValue={vi.fn()}
        onEvent={vi.fn()}
      />
    );
    expect(screen.getByText('Seleccione una opción')).toBeInTheDocument();
  });

  it('with remoteSearch does not refetch in a loop after options load', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      ctx.setOptions([{ label: 'One', value: '1' }]);
      return undefined;
    });
    const user = userEvent.setup();
    render(
      <Multiselect
        component={{
          key: 'mRemote',
          code: 'x',
          placeholder: 'Sel',
          infiniteScroll: true,
          remoteSearch: true,
          refetchOnEveryOpen: false,
          pageSize: 100,
        }}
        values={[]}
        data={{}}
        updateValue={vi.fn()}
        onEvent={vi.fn()}
      />
    );
    await user.click(screen.getByText('Sel'));
    await waitFor(() =>
      expect(screen.getByLabelText('One')).toBeInTheDocument()
    );
    const n = vi.mocked(evaluateKace).mock.calls.length;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(vi.mocked(evaluateKace).mock.calls.length).toBe(n);
  });

  it('keeps prior options when loading the next page without append in script', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const p = ctx.kaceSelectPage;
      if (p === 1) {
        ctx.setOptions(
          Array.from({ length: 10 }, (_, i) => ({
            label: i === 0 ? 'Alpha' : `o${i}`,
            value: `${i}`,
          }))
        );
      } else {
        ctx.setOptions([{ label: 'Beta', value: '10' }]);
      }
      return undefined;
    });
    const user = userEvent.setup();
    render(
      <Multiselect
        component={{
          key: 'm1',
          code: 'x',
          placeholder: 'Seleccione una opción',
          infiniteScroll: true,
          remoteSearch: false,
          refetchOnEveryOpen: false,
          pageSize: 10,
        }}
        values={[]}
        data={{}}
        updateValue={vi.fn()}
        onEvent={vi.fn()}
      />
    );
    await user.click(screen.getByText('Seleccione una opción'));
    await waitFor(() =>
      expect(screen.getByLabelText('Alpha')).toBeInTheDocument()
    );
    const menu = screen.getByTestId('kace-multiselect-scroll-menu');
    Object.defineProperty(menu, 'scrollHeight', {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(menu, 'clientHeight', {
      value: 100,
      configurable: true,
    });
    menu.scrollTop = 380;
    fireEvent.scroll(menu);
    await waitFor(() =>
      expect(screen.getByLabelText('Beta')).toBeInTheDocument()
    );
    expect(screen.getByLabelText('Alpha')).toBeInTheDocument();
  });

  it('stops firing evaluate after a final short or empty page', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const p = ctx.kaceSelectPage;
      if (p === 1) {
        ctx.setOptions(
          Array.from({ length: 20 }, (_, i) => ({
            label: `x${i}`,
            value: `${i}`,
          }))
        );
      } else {
        ctx.setOptions([]);
      }
      return undefined;
    });
    const user = userEvent.setup();
    render(
      <Multiselect
        component={{
          key: 'm2',
          code: 'x',
          placeholder: 'Seleccione una opción',
          infiniteScroll: true,
          remoteSearch: false,
          refetchOnEveryOpen: false,
          pageSize: 20,
        }}
        values={[]}
        data={{}}
        updateValue={vi.fn()}
        onEvent={vi.fn()}
      />
    );
    await user.click(screen.getByText('Seleccione una opción'));
    await waitFor(() =>
      expect(vi.mocked(evaluateKace)).toHaveBeenCalledTimes(1)
    );
    const menu = screen.getByTestId('kace-multiselect-scroll-menu');
    Object.defineProperty(menu, 'scrollHeight', {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(menu, 'clientHeight', {
      value: 100,
      configurable: true,
    });
    menu.scrollTop = 380;
    fireEvent.scroll(menu);
    await waitFor(() =>
      expect(vi.mocked(evaluateKace)).toHaveBeenCalledTimes(2)
    );
    fireEvent.scroll(menu);
    fireEvent.scroll(menu);
    await waitFor(() =>
      expect(vi.mocked(evaluateKace)).toHaveBeenCalledTimes(2)
    );
  });

  it('does not start a second page fetch while the first is still in flight', async () => {
    let resolveSecond;
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const p = ctx.kaceSelectPage;
      if (p === 1) {
        ctx.setOptions([{ label: 'A', value: 'a' }]);
        return undefined;
      }
      return new Promise((r) => {
        resolveSecond = r;
      }).then(() => {
        ctx.setOptions([{ label: 'B', value: 'b' }]);
      });
    });
    const user = userEvent.setup();
    render(
      <Multiselect
        component={{
          key: 'm3',
          code: 'x',
          placeholder: 'Seleccione una opción',
          infiniteScroll: true,
          remoteSearch: false,
          refetchOnEveryOpen: false,
          pageSize: 1,
        }}
        values={[]}
        data={{}}
        updateValue={vi.fn()}
        onEvent={vi.fn()}
      />
    );
    await user.click(screen.getByText('Seleccione una opción'));
    await waitFor(() =>
      expect(vi.mocked(evaluateKace)).toHaveBeenCalledTimes(1)
    );
    const menu = screen.getByTestId('kace-multiselect-scroll-menu');
    Object.defineProperty(menu, 'scrollHeight', {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(menu, 'clientHeight', {
      value: 100,
      configurable: true,
    });
    menu.scrollTop = 380;
    fireEvent.scroll(menu);
    fireEvent.scroll(menu);
    expect(vi.mocked(evaluateKace)).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveSecond();
    });
    await waitFor(() => expect(screen.getByLabelText('B')).toBeInTheDocument());
    expect(vi.mocked(evaluateKace)).toHaveBeenCalledTimes(2);
  });

  it('does not paginate when the menu has no scroll overflow', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      ctx.setOptions([{ label: 'Only', value: '1' }]);
      return undefined;
    });
    const user = userEvent.setup();
    render(
      <Multiselect
        component={{
          key: 'mNoOv',
          code: 'x',
          placeholder: 'P',
          infiniteScroll: true,
          remoteSearch: false,
          refetchOnEveryOpen: false,
          pageSize: 20,
        }}
        values={[]}
        data={{}}
        updateValue={vi.fn()}
        onEvent={vi.fn()}
      />
    );
    await user.click(screen.getByText('P'));
    await waitFor(() =>
      expect(vi.mocked(evaluateKace)).toHaveBeenCalledTimes(1)
    );
    const menu = screen.getByTestId('kace-multiselect-scroll-menu');
    Object.defineProperty(menu, 'scrollHeight', {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(menu, 'clientHeight', {
      value: 100,
      configurable: true,
    });
    menu.scrollTop = 0;
    fireEvent.scroll(menu);
    expect(vi.mocked(evaluateKace)).toHaveBeenCalledTimes(1);
  });

  it('clears all selections when Limpiar is clicked even if values prop is stale', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      ctx.setOptions([
        { label: 'Opt A', value: 'a' },
        { label: 'Opt B', value: 'b' },
      ]);
    });

    const updateValue = vi.fn();
    const selectedValues = [
      { label: 'Opt A', value: 'a' },
      { label: 'Opt B', value: 'b' },
    ];
    const user = userEvent.setup();

    render(
      <Multiselect
        component={{
          key: 'ms-clear-all',
          code: 'load',
          placeholder: 'Pick',
        }}
        updateValue={updateValue}
        values={selectedValues}
        data={{}}
        onEvent={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Opt A')).toBeInTheDocument();
      expect(screen.getByText('Opt B')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Opt A'));
    await user.click(screen.getByRole('button', { name: 'Limpiar' }));

    const trigger = document.querySelector('.form-control.d-flex');

    await waitFor(() => {
      expect(within(trigger).queryByText('Opt A')).not.toBeInTheDocument();
      expect(within(trigger).queryByText('Opt B')).not.toBeInTheDocument();
      expect(within(trigger).getByText('Pick')).toBeInTheDocument();
      expect(screen.getByLabelText('Opt A')).not.toBeChecked();
      expect(screen.getByLabelText('Opt B')).not.toBeChecked();
    });

    expect(updateValue).toHaveBeenCalledWith([]);
  });

  it('stops when the next page repeats the same rows as before', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      label: `x${i}`,
      value: `${i}`,
    }));
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      ctx.setOptions(rows);
      return undefined;
    });
    const user = userEvent.setup();
    render(
      <Multiselect
        component={{
          key: 'mDup',
          code: 'x',
          placeholder: 'Sel',
          infiniteScroll: true,
          remoteSearch: false,
          refetchOnEveryOpen: false,
          pageSize: 10,
        }}
        values={[]}
        data={{}}
        updateValue={vi.fn()}
        onEvent={vi.fn()}
      />
    );
    await user.click(screen.getByText('Sel'));
    await waitFor(() =>
      expect(vi.mocked(evaluateKace)).toHaveBeenCalledTimes(1)
    );
    const menu = screen.getByTestId('kace-multiselect-scroll-menu');
    Object.defineProperty(menu, 'scrollHeight', {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(menu, 'clientHeight', {
      value: 100,
      configurable: true,
    });
    menu.scrollTop = 380;
    fireEvent.scroll(menu);
    await waitFor(() =>
      expect(vi.mocked(evaluateKace)).toHaveBeenCalledTimes(2)
    );
    fireEvent.scroll(menu);
    await waitFor(() =>
      expect(vi.mocked(evaluateKace)).toHaveBeenCalledTimes(2)
    );
  });
});

/**
 * Fuga de listeners: `multiselect/index.js` pasa `onEvent: this.on.bind(this)`, una función
 * nueva en cada `renderReactComponent()` (que `setDisabled` dispara en cada redibujado del
 * formulario). Sin `offEvent` cada redibujado deja otra suscripción viva sobre el mismo emisor
 * compartido de Form.io. El emisor real (`Element.on`/`off`) apila y da de baja por identidad —
 * el doble que solo indexa por nombre no vería el problema.
 */
describe('Multiselect — suscripción a los eventos del componente', () => {
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
    component: { key: 'mEvt', code: 'x' },
    values: [],
    data: {},
    updateValue: vi.fn(),
  };

  it('deja una sola suscripción por evento aunque el componente se redibuje (setDisabled)', () => {
    const emitter = createEmitter();
    const { rerender } = render(
      <Multiselect
        {...baseProps}
        onEvent={(name, handler) => emitter.on(name, handler)}
        offEvent={(name, handler) => emitter.off(name, handler)}
      />
    );

    // Cada redibujado recibe enlaces nuevos, igual que `this.on.bind(this)` en producción.
    rerender(
      <Multiselect
        {...baseProps}
        onEvent={(name, handler) => emitter.on(name, handler)}
        offEvent={(name, handler) => emitter.off(name, handler)}
      />
    );
    rerender(
      <Multiselect
        {...baseProps}
        onEvent={(name, handler) => emitter.on(name, handler)}
        offEvent={(name, handler) => emitter.off(name, handler)}
      />
    );

    expect(emitter.count('kaceAuthData')).toBe(1);
    expect(emitter.count('redraw')).toBe(1);
    expect(emitter.count('resetForm')).toBe(1);
  });

  it('se da de baja al desmontar, sin dejar nada colgando del emisor compartido', () => {
    const emitter = createEmitter();
    const { unmount } = render(
      <Multiselect
        {...baseProps}
        onEvent={(name, handler) => emitter.on(name, handler)}
        offEvent={(name, handler) => emitter.off(name, handler)}
      />
    );

    unmount();

    expect(emitter.count('kaceAuthData')).toBe(0);
    expect(emitter.count('redraw')).toBe(0);
    expect(emitter.count('resetForm')).toBe(0);
  });
});
