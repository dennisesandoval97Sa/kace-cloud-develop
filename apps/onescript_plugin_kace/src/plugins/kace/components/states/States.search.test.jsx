import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Lo que devuelve `useStates`; cada test lo ajusta antes de renderizar. */
let hookResult;

vi.mock('#plugins/kace/hooks/useStates.js', () => ({
  default: () => hookResult,
}));

/** El buscador filtra DESPUÉS de esta capa, así que aquí pasa la lista tal cual. */
vi.mock('#plugins/kace/hooks/useStatesVisibility.js', () => ({
  default: ({ states }) => ({ visibleStates: states }),
}));

const { States } = await import('./States.jsx');

const estado = (n, nombre, extra = {}) => ({
  state_id: `estado-${n}`,
  transition_id: `trans-${n}`,
  nombre,
  ...extra,
});

/** Ocho estados: por encima del umbral que hace aparecer el buscador. */
const OCHO_ESTADOS = [
  estado(1, 'Abierto'),
  estado(2, 'En gestión'),
  estado(3, 'Escalado'),
  estado(4, 'Pendiente cliente'),
  estado(5, 'Pendiente proveedor'),
  estado(6, 'Resuelto'),
  estado(7, 'Cerrado efectivo'),
  estado(8, 'Cerrado no efectivo'),
];

function setHook(overrides = {}) {
  hookResult = {
    isLoading: false,
    defaultState: null,
    states: OCHO_ESTADOS,
    selected: null,
    solved_date: null,
    handleState: vi.fn(),
    ...overrides,
  };
}

const renderStates = (props = {}) =>
  render(
    <States
      onEvent={vi.fn()}
      handleChange={vi.fn()}
      root={null}
      component={{}}
      {...props}
    />
  );

const searchBox = () => screen.queryByLabelText('Buscar estado');
const stateButtons = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.textContent.replace('*', '').trim());

describe('States — buscador (OS-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHook();
  });

  it('filtra la lista en vivo al teclear', async () => {
    const user = userEvent.setup({ delay: null });
    renderStates();

    await user.type(searchBox(), 'cerrado');

    expect(stateButtons()).toEqual(['Cerrado efectivo', 'Cerrado no efectivo']);
  });

  it('ignora acentos y mayúsculas, como el resto del plugin', async () => {
    const user = userEvent.setup({ delay: null });
    renderStates();

    await user.type(searchBox(), 'GESTION');

    expect(stateButtons()).toEqual(['En gestión']);
  });

  it('avisa cuando ningún estado coincide', async () => {
    const user = userEvent.setup({ delay: null });
    renderStates();

    await user.type(searchBox(), 'zzz');

    expect(
      screen.getByText('Ningún estado coincide con la búsqueda.')
    ).toBeInTheDocument();
  });

  it('no aparece con pocos estados, donde estorba más de lo que ayuda', () => {
    setHook({ states: OCHO_ESTADOS.slice(0, 3) });
    renderStates();

    expect(searchBox()).toBeNull();
    expect(stateButtons()).toHaveLength(3);
  });

  it('se deshabilita junto con los estados', () => {
    renderStates({ disabled: true });

    expect(searchBox()).toBeDisabled();
  });

  it('no se muestra mientras cargan los estados', () => {
    setHook({ isLoading: true });
    renderStates();

    expect(searchBox()).toBeNull();
  });

  it('no se muestra con el caso cerrado', () => {
    setHook({ solved_date: 'Mon Sep 01 2026' });
    renderStates();

    expect(searchBox()).toBeNull();
    expect(screen.getByText('El caso esta cerrado')).toBeInTheDocument();
  });

  it('descarta el término al cambiar la lista de estados', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = renderStates();

    await user.type(searchBox(), 'cerrado');
    expect(stateButtons()).toHaveLength(2);

    // Otro flujo (p. ej. tras reclasificar): la búsqueda anterior no debe esconder nada.
    setHook({
      states: [
        estado(9, 'Nuevo A'),
        estado(10, 'Nuevo B'),
        estado(11, 'Nuevo C'),
        estado(12, 'Nuevo D'),
        estado(13, 'Nuevo E'),
        estado(14, 'Nuevo F'),
        estado(15, 'Nuevo G'),
      ],
    });
    rerender(
      <States
        onEvent={vi.fn()}
        handleChange={vi.fn()}
        root={null}
        component={{}}
      />
    );

    expect(searchBox()).toHaveValue('');
    expect(stateButtons()).toHaveLength(7);
  });

  it('marca los estados sujetos a una regla (OS-9)', () => {
    setHook({
      states: OCHO_ESTADOS.map((s, i) =>
        i === 0 ? { ...s, hasRule: true, ruleName: 'Requiere monto' } : s
      ),
    });
    renderStates();

    expect(
      screen.getByTitle('Sujeto a condiciones: Requiere monto')
    ).toBeInTheDocument();
    expect(
      screen.getByText('* Sujeto a condiciones que se verifican al guardar.')
    ).toBeInTheDocument();
  });
});
