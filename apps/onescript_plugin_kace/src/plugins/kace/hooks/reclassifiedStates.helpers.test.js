import { describe, expect, it } from 'vitest';
import { remapAvailableStates } from './reclassifiedStates.helpers.js';

const item = (transitionId, stateId, nombre) => ({
  transition: { id: transitionId },
  estado_actual: { id: 'estado-previo' },
  estado_siguiente: { id: stateId, nombre },
});

describe('remapAvailableStates', () => {
  it('adapta la forma case_available_states a la que consume useStates', () => {
    const result = remapAvailableStates([
      item('trans-1', 'estado-9', 'Cerrado efectivo'),
      item('trans-2', 'estado-10', 'En gestión'),
    ]);

    expect(result).toEqual([
      {
        transition_id: 'trans-1',
        state_id: 'estado-9',
        nombre: 'Cerrado efectivo',
        hasRule: false,
        ruleName: '',
      },
      {
        transition_id: 'trans-2',
        state_id: 'estado-10',
        nombre: 'En gestión',
        hasRule: false,
        ruleName: '',
      },
    ]);
  });

  it('marca los estados cuya transición tiene una regla', () => {
    const result = remapAvailableStates(
      [
        item('trans-1', 'estado-9', 'Cerrado efectivo'),
        item('trans-2', 'estado-10', 'En gestión'),
      ],
      [{ transicion_id: 'trans-2', rule_id: 'r1', nombre: 'Requiere monto' }]
    );

    expect(result[0]).toMatchObject({ hasRule: false, ruleName: '' });
    expect(result[1]).toMatchObject({
      hasRule: true,
      ruleName: 'Requiere monto',
    });
  });

  it('compara los ids como texto, sin importar su tipo', () => {
    const result = remapAvailableStates(
      [item(7, 'estado-9', 'Cerrado')],
      [{ transicion_id: '7', nombre: 'Requiere monto' }]
    );

    expect(result[0]).toMatchObject({ transition_id: '7', hasRule: true });
  });

  it('se queda con la primera regla cuando una transición trae varias', () => {
    const result = remapAvailableStates(
      [item('trans-1', 'estado-9', 'Cerrado')],
      [
        { transicion_id: 'trans-1', nombre: 'Primera' },
        { transicion_id: 'trans-1', nombre: 'Segunda' },
      ]
    );

    expect(result[0].ruleName).toBe('Primera');
  });

  it('marca la regla aunque el backend no le ponga nombre', () => {
    const result = remapAvailableStates(
      [item('trans-1', 'estado-9', 'Cerrado')],
      [{ transicion_id: 'trans-1' }]
    );

    expect(result[0]).toMatchObject({ hasRule: true, ruleName: '' });
  });

  it('descarta filas sin transición o sin estado destino, que no son seleccionables', () => {
    const result = remapAvailableStates([
      { transition: null, estado_siguiente: { id: 'estado-9' } },
      { transition: { id: 'trans-2' }, estado_siguiente: null },
      item('trans-3', 'estado-11', 'Válido'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].transition_id).toBe('trans-3');
  });

  it('tolera un nombre ausente sin romper la lista', () => {
    const result = remapAvailableStates([
      { transition: { id: 't1' }, estado_siguiente: { id: 'e1' } },
    ]);

    expect(result[0].nombre).toBe('');
  });

  it.each([null, undefined, {}, 'nope'])(
    'devuelve una lista vacía para %p',
    (value) => {
      expect(remapAvailableStates(value)).toEqual([]);
    }
  );

  it.each([null, undefined, 'nope'])(
    'ignora unas reglas con forma inesperada (%p)',
    (value) => {
      const result = remapAvailableStates([item('t1', 'e1', 'X')], value);
      expect(result[0]).toMatchObject({ hasRule: false });
    }
  );
});
