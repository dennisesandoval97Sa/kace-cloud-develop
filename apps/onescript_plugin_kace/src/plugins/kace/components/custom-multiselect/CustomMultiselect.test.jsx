import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import { CustomMultiselect } from './CustomMultiselect.jsx';

// Usamos una instancia estable para evitar que kaceEngine cambie en cada render
// (lo que causaría un loop infinito en effects que dependen de kaceEngine).
const _stableKaceEngineInstance = {
  getService: (name) =>
    name === 'storeService'
      ? { get: () => 'http://localhost' }
      : { get: vi.fn(), post: vi.fn() },
};
vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => _stableKaceEngineInstance,
}));

vi.mock('#plugins/kace/shared/evaluateKace.js', () => ({
  evaluateKace: vi.fn(() => undefined),
}));

// Mockeamos el debounce para que devuelva el valor inmediatamente (sin delay)
// Esto evita usar fake timers con userEvent, que causa loops de memoria en jsdom.
vi.mock('#plugins/kace/hooks/useDebouncedStableTerm.js', () => ({
  useDebouncedStableTerm: (value) => value,
}));

describe('CustomMultiselect segmented menu', () => {
  it('uses sticky header for search inside the scroll dropdown', async () => {
    const user = userEvent.setup();
    render(
      <CustomMultiselect
        component={{
          key: 'cm1',
          code: '',
          infiniteScroll: true,
          remoteSearch: true,
          placeholder: 'Pick one',
        }}
        updateValue={vi.fn()}
        values={[]}
        data={{}}
        onEvent={vi.fn()}
      />
    );
    await user.click(screen.getByText('Pick one'));
    const panel = screen.getByTestId('kace-custom-multiselect-options-scroll');
    const input = screen.getByPlaceholderText('Buscar...');
    expect(panel.contains(input)).toBe(true);
    expect(input.closest('.kace-multiselect-menu-sticky')).not.toBeNull();
  });

  it('shows option rows after evaluate calls setOptions', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      if (typeof ctx.setOptions === 'function') {
        ctx.setOptions([{ label: 'Row A', value: '1' }]);
      }
      return undefined;
    });
    const user = userEvent.setup();
    render(
      <CustomMultiselect
        component={{
          key: 'cm2',
          code: 'load',
          infiniteScroll: true,
          remoteSearch: false,
          placeholder: 'Open',
        }}
        updateValue={vi.fn()}
        values={[]}
        data={{}}
        onEvent={vi.fn()}
      />
    );
    await user.click(screen.getByText('Open'));
    await waitFor(() => expect(screen.getByText('Row A')).toBeInTheDocument());
  });

  it('preserves selection when remote search term changes (remoteSearch + dependsOn)', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const term = String(ctx.kaceRemoteSearchTerm ?? '').toLowerCase();
      if (!term) {
        ctx.setOptions([
          { label: 'Medellín', value: 'medellin' },
          { label: 'Bello', value: 'bello' },
        ]);
        return;
      }
      ctx.setOptions([{ label: 'Bello', value: 'bello' }]);
    });

    const updateValue = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          remoteSearch: true,
          dependsOn: 'departamento',
          multiple: true,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={[]}
        data={{ departamento: [{ value: 'ant', label: 'Antioquia' }] }}
        onEvent={vi.fn()}
        dependencyValue={[{ value: 'ant', label: 'Antioquia' }]}
      />
    );

    // Abrir dropdown y esperar que carguen las opciones
    await user.click(screen.getByText('Municipio'));
    await waitFor(() => screen.getByText('Medellín'));

    // Seleccionar Medellín
    await user.click(screen.getByText('Medellín'));

    // Limpiar historial de llamadas a updateValue para aislarlo
    updateValue.mockClear();

    // Disparar cambio en el search box — el debounce está mockeado a 0ms,
    // así que stableRemoteTerm cambia inmediatamente y dispara el efecto de búsqueda
    const searchInput = screen.getByPlaceholderText('Buscar...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Bello' } });
    });

    // Esperar a que los resultados de búsqueda de Bello sean visibles en el dropdown
    await waitFor(() => expect(screen.getByText('Bello')).toBeInTheDocument());

    // La selección de Medellín NO debe haber sido borrada:
    // updateValue no debe haber sido llamado con array vacío
    const emptyArrayCalls = updateValue.mock.calls.filter(
      ([arg]) => Array.isArray(arg) && arg.length === 0
    );
    expect(emptyArrayCalls).toHaveLength(0);

    // El badge de Medellín debe seguir visible en el trigger del select
    expect(
      within(container.querySelector('.multi-select-input')).getByText(
        'Medellín'
      )
    ).toBeInTheDocument();
  });

  it('does not show selected items in remote search results when they are not returned by the API', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const term = String(ctx.kaceRemoteSearchTerm ?? '').toLowerCase();
      if (term.includes('santafe')) {
        ctx.setOptions([
          { label: 'SANTAFE DE ANTIOQUIA', value: 'santafe_antioquia' },
          {
            label: 'SANTAFE DEL CLARO (RIO VERDE)',
            value: 'santafe_claro',
          },
        ]);
        return;
      }
      ctx.setOptions([{ label: 'Medellín', value: 'medellin' }]);
    });

    const user = userEvent.setup();
    const selectedMunicipios = [{ label: 'MEDELLIN', value: 'medellin' }];

    const { container } = render(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          remoteSearch: true,
          multiple: true,
          placeholder: 'Municipio',
        }}
        updateValue={vi.fn()}
        values={selectedMunicipios}
        data={{}}
        onEvent={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('MEDELLIN')).toBeInTheDocument();
    });

    await user.click(container.querySelector('.multi-select-input'));
    const searchInput = screen.getByPlaceholderText('Buscar...');

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'santafe' } });
    });

    await waitFor(() => {
      expect(screen.getByText('SANTAFE DE ANTIOQUIA')).toBeInTheDocument();
      expect(
        screen.getByText('SANTAFE DEL CLARO (RIO VERDE)')
      ).toBeInTheDocument();
    });

    const dropdown = screen.getByTestId(
      'kace-custom-multiselect-options-scroll'
    );
    expect(within(dropdown).queryByText('MEDELLIN')).not.toBeInTheDocument();
    expect(within(dropdown).queryByText('Medellín')).not.toBeInTheDocument();
  });

  it('preserves selection after remount simulating form.redraw()', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      ctx.setOptions([
        { label: 'Opt A', value: 'a' },
        { label: 'Opt B', value: 'b' },
      ]);
    });

    const updateValue = vi.fn();
    const selectedValues = [{ label: 'Opt A', value: 'a' }];
    const props = {
      component: {
        key: 'ms-redraw',
        code: 'load',
        multiple: true,
        placeholder: 'Pick',
      },
      updateValue,
      values: selectedValues,
      data: {},
      onEvent: vi.fn(),
    };

    const { unmount } = render(<CustomMultiselect {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Opt A')).toBeInTheDocument();
    });

    updateValue.mockClear();
    unmount();
    render(<CustomMultiselect {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Opt A')).toBeInTheDocument();
    });

    const emptyArrayCalls = updateValue.mock.calls.filter(
      ([arg]) => Array.isArray(arg) && arg.length === 0
    );
    expect(emptyArrayCalls).toHaveLength(0);
  });

  it('preserves selection when redraw event reloads options', async () => {
    let loadCount = 0;
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      loadCount += 1;
      if (loadCount === 1) {
        ctx.setOptions([
          { label: 'Opt A', value: 'a' },
          { label: 'Opt B', value: 'b' },
        ]);
        return;
      }
      ctx.setOptions([{ label: 'Opt B', value: 'b' }]);
    });

    const updateValue = vi.fn();
    const onEventHandlers = {};
    const onEvent = vi.fn((event, handler) => {
      onEventHandlers[event] = handler;
    });
    const selectedValues = [{ label: 'Opt A', value: 'a' }];

    render(
      <CustomMultiselect
        component={{
          key: 'ms-redraw-event',
          code: 'load',
          multiple: true,
          placeholder: 'Pick',
        }}
        updateValue={updateValue}
        values={selectedValues}
        data={{}}
        onEvent={onEvent}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Opt A')).toBeInTheDocument();
    });

    updateValue.mockClear();

    await act(async () => {
      onEventHandlers.redraw?.();
    });

    await waitFor(() => {
      expect(screen.getByText('Opt A')).toBeInTheDocument();
    });

    const emptyArrayCalls = updateValue.mock.calls.filter(
      ([arg]) => Array.isArray(arg) && arg.length === 0
    );
    expect(emptyArrayCalls).toHaveLength(0);
  });

  it('removes municipios when parent departamento is cleared', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const term = ctx.kaceRemoteSearchTerm ?? '';
      if (!term) {
        ctx.setOptions([
          { label: 'Medellín', value: 'medellin' },
          { label: 'Bello', value: 'bello' },
        ]);
        return;
      }
      ctx.setOptions([]);
    });

    const updateValue = vi.fn();
    const depValue = [{ value: 'ant', label: 'Antioquia' }];
    const selectedMunicipios = [
      { label: 'Medellín', value: 'medellin' },
      { label: 'Bello', value: 'bello' },
    ];

    const { rerender } = render(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          remoteSearch: true,
          dependsOn: 'departamento',
          multiple: true,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={selectedMunicipios}
        data={{ departamento: depValue }}
        onEvent={vi.fn()}
        dependencyValue={depValue}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Medellín')).toBeInTheDocument();
    });

    updateValue.mockClear();

    rerender(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          remoteSearch: true,
          dependsOn: 'departamento',
          multiple: true,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={selectedMunicipios}
        data={{ departamento: [] }}
        onEvent={vi.fn()}
        dependencyValue={[]}
        dependencyChanged
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Medellín')).not.toBeInTheDocument();
      expect(screen.queryByText('Bello')).not.toBeInTheDocument();
    });

    expect(updateValue).toHaveBeenCalledWith([]);
  });

  it('keeps all municipios when one departamento is removed but others remain', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const deps = ctx.data?.departamento ?? [];
      const depValues = Array.isArray(deps)
        ? deps.map((d) => String(d?.value ?? d))
        : [String(deps?.value ?? deps)];

      if (depValues.includes('ant') && depValues.includes('cun')) {
        ctx.setOptions([
          { label: 'Medellín', value: 'medellin' },
          { label: 'Bello', value: 'bello' },
          { label: 'Bogotá', value: 'bogota' },
        ]);
        return;
      }

      if (depValues.includes('cun')) {
        ctx.setOptions([{ label: 'Bogotá', value: 'bogota' }]);
        return;
      }

      ctx.setOptions([]);
    });

    const updateValue = vi.fn();
    const bothDeps = [
      { value: 'ant', label: 'Antioquia' },
      { value: 'cun', label: 'Cundinamarca' },
    ];
    const selectedMunicipios = [
      { label: 'Medellín', value: 'medellin' },
      { label: 'Bogotá', value: 'bogota' },
    ];

    const { rerender } = render(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          remoteSearch: true,
          dependsOn: 'departamento',
          multiple: true,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={selectedMunicipios}
        data={{ departamento: bothDeps }}
        onEvent={vi.fn()}
        dependencyValue={bothDeps}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Medellín')).toBeInTheDocument();
      expect(screen.getByText('Bogotá')).toBeInTheDocument();
    });

    updateValue.mockClear();

    const onlyCundinamarca = [{ value: 'cun', label: 'Cundinamarca' }];

    rerender(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          remoteSearch: true,
          dependsOn: 'departamento',
          multiple: true,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={selectedMunicipios}
        data={{ departamento: onlyCundinamarca }}
        onEvent={vi.fn()}
        dependencyValue={onlyCundinamarca}
        dependencyChanged
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Medellín')).toBeInTheDocument();
      expect(screen.getByText('Bogotá')).toBeInTheDocument();
    });

    expect(updateValue).not.toHaveBeenCalled();
  });

  it('clears municipio on mount when departamento is empty but municipio has values', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      ctx.setOptions([]);
    });

    const updateValue = vi.fn();
    const selectedMunicipios = [{ label: 'Medellín', value: 'medellin' }];

    render(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          remoteSearch: true,
          dependsOn: 'departamento',
          multiple: true,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={selectedMunicipios}
        data={{ departamento: [] }}
        onEvent={vi.fn()}
        dependencyValue={[]}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Medellín')).not.toBeInTheDocument();
      expect(screen.getByText('Municipio')).toBeInTheDocument();
    });

    expect(updateValue).toHaveBeenCalledWith([]);
  });

  it('does not duplicate preloaded options when catalog value differs from selected value', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      ctx.setOptions([
        { label: 'BOGOTA D.C.', value: 11 },
        { label: 'VICHADA', value: 99 },
        { label: 'VAUPES', value: 91 },
      ]);
    });

    const user = userEvent.setup();
    render(
      <CustomMultiselect
        component={{
          key: 'departamento',
          code: 'load',
          multiple: true,
          placeholder: 'Departamento',
        }}
        updateValue={vi.fn()}
        values={[
          { label: 'BOGOTA D.C.', value: 'BOGOTA D.C.' },
          { label: 'VICHADA', value: 'VICHADA' },
          { label: 'VAUPES', value: 'VAUPES' },
        ]}
        data={{}}
        onEvent={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('BOGOTA D.C.')).toBeInTheDocument();
    });

    const input = document.querySelector('.multi-select-input');
    await user.click(input);

    const dropdown = await screen.findByTestId(
      'kace-custom-multiselect-options-scroll'
    );

    await waitFor(() => {
      expect(within(dropdown).getAllByText('BOGOTA D.C.')).toHaveLength(1);
    });

    const bogotaRow = within(dropdown)
      .getByText('BOGOTA D.C.')
      .closest('.multi-select-option');
    expect(within(bogotaRow).getByRole('checkbox')).toBeChecked();
  });

  it('removes a chip without restoring when values prop is stale', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      ctx.setOptions([
        { label: 'TOLIMA', value: 'tolima' },
        { label: 'VALLE DEL CAUCA', value: 'valle' },
        { label: 'VAUPES', value: 'vaupes' },
      ]);
    });

    const updateValue = vi.fn();
    const selectedValues = [
      { label: 'TOLIMA', value: 'tolima' },
      { label: 'VALLE DEL CAUCA', value: 'valle' },
      { label: 'VAUPES', value: 'vaupes' },
    ];

    const props = {
      component: {
        key: 'departamento',
        code: 'load',
        multiple: true,
        placeholder: 'Departamento',
      },
      updateValue,
      values: selectedValues,
      data: {},
      onEvent: vi.fn(),
    };

    const { rerender } = render(<CustomMultiselect {...props} />);

    await waitFor(() => {
      expect(screen.getByText('TOLIMA')).toBeInTheDocument();
    });

    const tolimaBadge = screen.getByText('TOLIMA').closest('.badge');
    fireEvent.click(within(tolimaBadge).getByText('×'));

    rerender(<CustomMultiselect {...props} />);

    await waitFor(() => {
      expect(screen.queryByText('TOLIMA')).not.toBeInTheDocument();
      expect(screen.getByText('VALLE DEL CAUCA')).toBeInTheDocument();
      expect(screen.getByText('VAUPES')).toBeInTheDocument();
    });

    expect(updateValue).toHaveBeenCalledWith([
      { label: 'VALLE DEL CAUCA', value: 'valle' },
      { label: 'VAUPES', value: 'vaupes' },
    ]);
  });

  it('removes multiple chips sequentially without restoring previous removals', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      ctx.setOptions([
        { label: 'TOLIMA', value: 'tolima' },
        { label: 'VALLE DEL CAUCA', value: 'valle' },
        { label: 'VAUPES', value: 'vaupes' },
      ]);
    });

    const updateValue = vi.fn();
    const selectedValues = [
      { label: 'TOLIMA', value: 'tolima' },
      { label: 'VALLE DEL CAUCA', value: 'valle' },
      { label: 'VAUPES', value: 'vaupes' },
    ];

    const props = {
      component: {
        key: 'departamento',
        code: 'load',
        multiple: true,
        placeholder: 'Departamento',
      },
      updateValue,
      values: selectedValues,
      data: {},
      onEvent: vi.fn(),
    };

    render(<CustomMultiselect {...props} />);

    await waitFor(() => {
      expect(screen.getByText('TOLIMA')).toBeInTheDocument();
    });

    const removeChip = (label) => {
      const badge = screen.getByText(label).closest('.badge');
      fireEvent.click(within(badge).getByText('×'));
    };

    removeChip('TOLIMA');
    await waitFor(() => {
      expect(screen.queryByText('TOLIMA')).not.toBeInTheDocument();
    });

    removeChip('VALLE DEL CAUCA');
    await waitFor(() => {
      expect(screen.queryByText('TOLIMA')).not.toBeInTheDocument();
      expect(screen.queryByText('VALLE DEL CAUCA')).not.toBeInTheDocument();
      expect(screen.getByText('VAUPES')).toBeInTheDocument();
    });
  });

  it('clears all selections when Quitar todos is clicked even if values prop is stale', async () => {
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
      <CustomMultiselect
        component={{
          key: 'ms-clear-all',
          code: 'load',
          multiple: true,
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
    await user.click(screen.getByRole('button', { name: 'Quitar todos' }));

    await waitFor(() => {
      expect(screen.queryByText('Opt A')).not.toBeInTheDocument();
      expect(screen.queryByText('Opt B')).not.toBeInTheDocument();
      expect(screen.getByText('Pick')).toBeInTheDocument();
    });

    expect(updateValue).toHaveBeenCalledWith([]);
  });

  it('clears municipio when departamento becomes empty even if values prop is stale', async () => {
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const deps = ctx.data?.departamento ?? [];
      const depValues = Array.isArray(deps) ? deps : [deps];
      if (depValues.length === 0) {
        ctx.setOptions([]);
        return;
      }
      ctx.setOptions([{ label: 'Medellín', value: 'medellin' }]);
    });

    const updateValue = vi.fn();
    const depValue = [{ value: 'ant', label: 'Antioquia' }];
    const selectedMunicipios = [{ label: 'Medellín', value: 'medellin' }];

    const { rerender } = render(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          dependsOn: 'departamento',
          multiple: true,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={selectedMunicipios}
        data={{ departamento: depValue }}
        onEvent={vi.fn()}
        dependencyValue={depValue}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Medellín')).toBeInTheDocument();
    });

    updateValue.mockClear();

    rerender(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          dependsOn: 'departamento',
          multiple: true,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={selectedMunicipios}
        data={{ departamento: [] }}
        onEvent={vi.fn()}
        dependencyValue={[]}
        dependencyChanged
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Medellín')).not.toBeInTheDocument();
    });

    expect(updateValue).toHaveBeenCalledWith([]);
  });

  it('selects all matching items across pages when Seleccionar todos is clicked (infinite scroll)', async () => {
    const pageSize = 3;
    const allItems = Array.from({ length: 7 }, (_, i) => ({
      label: `Muni ${i + 1}`,
      value: `muni-${i + 1}`,
    }));

    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const page = ctx.kaceSelectPage ?? 1;
      const size = ctx.kaceSelectPageSize ?? pageSize;
      const start = (page - 1) * size;
      ctx.setOptions(allItems.slice(start, start + size));
      return undefined;
    });

    const updateValue = vi.fn();
    const user = userEvent.setup();

    render(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          infiniteScroll: true,
          remoteSearch: true,
          multiple: true,
          pageSize,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={[]}
        data={{}}
        onEvent={vi.fn()}
      />
    );

    await user.click(screen.getByText('Municipio'));
    await waitFor(() => expect(screen.getByText('Muni 1')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Seleccionar todos' }));

    await waitFor(() => expect(updateValue).toHaveBeenLastCalledWith(allItems));
  });

  it('selects only items matching the current search term on Seleccionar todos', async () => {
    const pageSize = 3;
    const allItems = Array.from({ length: 7 }, (_, i) => ({
      label: `Muni ${i + 1}`,
      value: `muni-${i + 1}`,
    }));
    const sanItems = Array.from({ length: 4 }, (_, i) => ({
      label: `San ${i + 1}`,
      value: `san-${i + 1}`,
    }));

    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const page = ctx.kaceSelectPage ?? 1;
      const size = ctx.kaceSelectPageSize ?? pageSize;
      const term = String(ctx.kaceRemoteSearchTerm ?? '').toLowerCase();
      const pool = term.includes('san') ? sanItems : allItems;
      const start = (page - 1) * size;
      ctx.setOptions(pool.slice(start, start + size));
      return undefined;
    });

    const updateValue = vi.fn();
    const user = userEvent.setup();

    render(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          infiniteScroll: true,
          remoteSearch: true,
          multiple: true,
          pageSize,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={[]}
        data={{}}
        onEvent={vi.fn()}
      />
    );

    await user.click(screen.getByText('Municipio'));
    await waitFor(() => expect(screen.getByText('Muni 1')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Buscar...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'san' } });
    });
    await waitFor(() => expect(screen.getByText('San 1')).toBeInTheDocument());

    updateValue.mockClear();
    await user.click(screen.getByRole('button', { name: 'Seleccionar todos' }));

    await waitFor(() => expect(updateValue).toHaveBeenLastCalledWith(sanItems));
  });

  it('does not inject temp option rows when many selected are not loaded', async () => {
    const pageSize = 3;
    const loaded = Array.from({ length: 3 }, (_, i) => ({
      label: `Muni ${i + 1}`,
      value: `muni-${i + 1}`,
    }));
    const selected = Array.from({ length: 7 }, (_, i) => ({
      label: `Muni ${i + 1}`,
      value: `muni-${i + 1}`,
    }));

    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      ctx.setOptions(loaded);
      return undefined;
    });

    const user = userEvent.setup();

    const { container } = render(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          infiniteScroll: true,
          remoteSearch: true,
          multiple: true,
          pageSize,
          placeholder: 'Municipio',
        }}
        updateValue={vi.fn()}
        values={selected}
        data={{}}
        onEvent={vi.fn()}
      />
    );

    await user.click(container.querySelector('.multi-select-input'));
    const dropdown = await screen.findByTestId(
      'kace-custom-multiselect-options-scroll'
    );
    await waitFor(() =>
      expect(within(dropdown).getByText('Muni 1')).toBeInTheDocument()
    );

    expect(within(dropdown).getAllByRole('checkbox')).toHaveLength(3);
  });

  it('terminates bulk select-all when backend always returns full pages', async () => {
    const pageSize = 3;
    vi.mocked(evaluateKace).mockClear();
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const page = ctx.kaceSelectPage ?? 1;
      ctx.setOptions(
        Array.from({ length: pageSize }, (_, i) => ({
          label: `Muni ${page}-${i + 1}`,
          value: `muni-${page}-${i + 1}`,
        }))
      );
      return undefined;
    });

    const updateValue = vi.fn();
    const user = userEvent.setup();

    render(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          infiniteScroll: true,
          remoteSearch: true,
          multiple: true,
          pageSize,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={[]}
        data={{}}
        onEvent={vi.fn()}
      />
    );

    await user.click(screen.getByText('Municipio'));
    await waitFor(() =>
      expect(screen.getByText('Muni 1-1')).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Seleccionar todos' }));

    await waitFor(() => {
      const lastCall =
        updateValue.mock.calls[updateValue.mock.calls.length - 1];
      expect(Array.isArray(lastCall?.[0]) ? lastCall[0].length : 0).toBe(300);
    });

    const pageCalls = vi
      .mocked(evaluateKace)
      .mock.calls.filter(
        ([, ctx]) => ctx && typeof ctx.kaceSelectPage === 'number'
      ).length;
    expect(pageCalls).toBeLessThanOrEqual(101);
  });

  it('preserves current selection if bulk select-all fetch fails mid-way', async () => {
    const pageSize = 2;
    vi.mocked(evaluateKace).mockImplementation((_code, ctx) => {
      const page = ctx.kaceSelectPage ?? 1;
      if (page === 1) {
        ctx.setOptions([
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ]);
        return undefined;
      }
      throw new Error('network');
    });

    const updateValue = vi.fn();
    const user = userEvent.setup();

    render(
      <CustomMultiselect
        component={{
          key: 'municipio',
          code: 'load',
          infiniteScroll: true,
          remoteSearch: true,
          multiple: true,
          pageSize,
          placeholder: 'Municipio',
        }}
        updateValue={updateValue}
        values={[]}
        data={{}}
        onEvent={vi.fn()}
      />
    );

    await user.click(screen.getByText('Municipio'));
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());

    updateValue.mockClear();
    await user.click(screen.getByRole('button', { name: 'Seleccionar todos' }));

    expect(updateValue).not.toHaveBeenCalledWith([
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ]);
  });
});

/**
 * Fuga de listeners (code review MSKT-1392): `index.js` pasa `onEvent: this.on.bind(this)`, una
 * función nueva en cada `renderReactComponent()` —que `setDisabled()` dispara en cada redibujado
 * del formulario—. Sin `offEvent` cada redibujado deja otra suscripción viva sobre el mismo
 * emisor compartido. El emisor real (`Element.on`/`off`) apila y da de baja por identidad — un
 * doble que solo indexa por nombre no vería el problema.
 */
describe('CustomMultiselect — suscripción a los eventos del componente', () => {
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
    component: { key: 'cmEvt', code: '' },
    values: [],
    data: {},
    updateValue: vi.fn(),
    onEvent: (name, handler) => emitter.on(name, handler),
    offEvent: (name, handler) => emitter.off(name, handler),
  });

  it('deja una sola suscripción por evento aunque el componente se redibuje (setDisabled)', () => {
    const emitter = createEmitter();
    const { rerender } = render(<CustomMultiselect {...propsWith(emitter)} />);
    rerender(<CustomMultiselect {...propsWith(emitter)} />);
    rerender(<CustomMultiselect {...propsWith(emitter)} />);

    expect(emitter.count('kaceAuthData')).toBe(1);
    expect(emitter.count('redraw')).toBe(1);
    expect(emitter.count('resetForm')).toBe(1);
  });

  it('se da de baja al desmontar, sin dejar nada colgando del emisor compartido', () => {
    const emitter = createEmitter();
    const { unmount } = render(<CustomMultiselect {...propsWith(emitter)} />);

    unmount();

    expect(emitter.count('kaceAuthData')).toBe(0);
    expect(emitter.count('redraw')).toBe(0);
    expect(emitter.count('resetForm')).toBe(0);
  });
});
