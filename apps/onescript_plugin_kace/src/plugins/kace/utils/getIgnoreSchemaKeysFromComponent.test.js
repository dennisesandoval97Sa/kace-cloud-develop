import { describe, expect, it } from 'vitest';
import {
  getIgnoreSchemaKeysFromComponent,
  keysNotInSchema,
} from './getIgnoreSchemaKeysFromComponent.js';

describe('getIgnoreSchemaKeysFromComponent', () => {
  it('lee un array de strings', () => {
    expect(
      getIgnoreSchemaKeysFromComponent({ ignoreSchemaKeys: ['a', 'b'] })
    ).toEqual(['a', 'b']);
  });

  it('lee un array de objetos con key (editgrid)', () => {
    expect(
      getIgnoreSchemaKeysFromComponent({
        ignoreSchemaKeys: [{ key: 'a' }, { key: 'b' }],
      })
    ).toEqual(['a', 'b']);
  });

  it('devuelve undefined sin configuración, para que el llamador use el default', () => {
    expect(getIgnoreSchemaKeysFromComponent({})).toBeUndefined();
    expect(getIgnoreSchemaKeysFromComponent(null)).toBeUndefined();
    expect(
      getIgnoreSchemaKeysFromComponent({ ignoreSchemaKeys: [] })
    ).toBeUndefined();
  });
});

describe('keysNotInSchema', () => {
  const schema = { nombre: {}, monto: {} };

  it('un formulario no reclasificado no tiene huérfanas', () => {
    expect(keysNotInSchema(schema, { nombre: 'x', monto: 1 })).toEqual([]);
    expect(keysNotInSchema(schema, { nombre: 'x' })).toEqual([]);
  });

  it('devuelve solo las llaves que el schema vigente no declara', () => {
    expect(
      keysNotInSchema(schema, {
        nombre: 'x',
        motivo_no_venta: 'previo',
        canal_previo: 'previo',
      })
    ).toEqual(['motivo_no_venta', 'canal_previo']);
  });

  it('no mira dentro de las llaves declaradas', () => {
    expect(
      keysNotInSchema(schema, { nombre: 'x', monto: { huerfana_anidada: 1 } })
    ).toEqual([]);
  });

  it('con schema vacío no descarta nada: el payload se sigue rechazando como hoy', () => {
    expect(keysNotInSchema({}, { nombre: 'x' })).toEqual([]);
  });

  it('tolera entradas ausentes', () => {
    expect(keysNotInSchema(null, { a: 1 })).toEqual([]);
    expect(keysNotInSchema(schema, null)).toEqual([]);
  });
});
