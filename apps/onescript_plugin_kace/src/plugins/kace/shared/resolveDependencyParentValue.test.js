import { describe, it, expect } from 'vitest';
import {
  formioTypeNestsData,
  formioTypeNestsArray,
  nextDependencyPath,
  dependencyPathFromFormioPath,
  resolveDependencyParentValue,
  resolveDependencyParentScope,
} from './resolveDependencyParentValue.js';

describe('formioTypeNestsData', () => {
  it('is true for container, editgrid, datagrid, form, and tree', () => {
    expect(formioTypeNestsData('container')).toBe(true);
    expect(formioTypeNestsData('editgrid')).toBe(true);
    expect(formioTypeNestsData('datagrid')).toBe(true);
    expect(formioTypeNestsData('form')).toBe(true);
    expect(formioTypeNestsData('tree')).toBe(true);
    expect(formioTypeNestsData('panel')).toBe(false);
    expect(formioTypeNestsData('columns')).toBe(false);
    expect(formioTypeNestsData('tabs')).toBe(false);
    expect(formioTypeNestsData('table')).toBe(false);
  });
});

describe('formioTypeNestsArray', () => {
  it('is true only for editgrid and datagrid', () => {
    expect(formioTypeNestsArray('editgrid')).toBe(true);
    expect(formioTypeNestsArray('datagrid')).toBe(true);
    expect(formioTypeNestsArray('container')).toBe(false);
    expect(formioTypeNestsArray('form')).toBe(false);
  });
});

describe('nextDependencyPath', () => {
  it('appends a path segment only when the Form.io type nests submission data', () => {
    expect(
      nextDependencyPath([], 'container', 'asignacion_asistencia_movilidad')
    ).toEqual([{ key: 'asignacion_asistencia_movilidad', nestsArray: false }]);
    expect(nextDependencyPath([], 'editgrid', 'items')).toEqual([
      { key: 'items', nestsArray: true },
    ]);
    expect(nextDependencyPath([], 'panel', 'asignacion')).toEqual([]);
    expect(
      nextDependencyPath(
        [{ key: 'asignacion_asistencia_movilidad', nestsArray: false }],
        'columns',
        'cols'
      )
    ).toEqual([{ key: 'asignacion_asistencia_movilidad', nestsArray: false }]);
  });
});

describe('dependencyPathFromFormioPath', () => {
  it('drops the field key and array indices', () => {
    expect(
      dependencyPathFromFormioPath(
        'asignacion_asistencia_movilidad.correo_electronico',
        'correo_electronico'
      )
    ).toEqual(['asignacion_asistencia_movilidad']);
    expect(dependencyPathFromFormioPath('items[0].flag', 'flag')).toEqual([
      'items',
    ]);
    expect(dependencyPathFromFormioPath('', 'x')).toEqual([]);
    expect(dependencyPathFromFormioPath(undefined, 'x')).toEqual([]);
  });
});

describe('resolveDependencyParentValue', () => {
  it('reads the sibling inside a nested object', () => {
    const rootData = {
      asignacion_asistencia_movilidad: { linea: 'AUTOS' },
    };
    expect(
      resolveDependencyParentValue(
        rootData,
        ['asignacion_asistencia_movilidad'],
        'linea'
      )
    ).toBe('AUTOS');
  });

  it('falls back to root when the nested object lacks the key', () => {
    const rootData = {
      linea: 'AUTOS',
      asignacion_asistencia_movilidad: {},
    };
    expect(
      resolveDependencyParentValue(
        rootData,
        ['asignacion_asistencia_movilidad'],
        'linea'
      )
    ).toBe('AUTOS');
  });

  it('does not fall through when the sibling exists and is empty', () => {
    const rootData = {
      linea: 'RAIZ',
      asignacion_asistencia_movilidad: { linea: '' },
    };
    expect(
      resolveDependencyParentValue(
        rootData,
        ['asignacion_asistencia_movilidad'],
        'linea'
      )
    ).toBe('');
  });

  it('does not fall through when the sibling exists and is undefined', () => {
    const rootData = {
      linea: 'RAIZ',
      asignacion_asistencia_movilidad: { linea: undefined },
    };
    expect(
      resolveDependencyParentValue(
        rootData,
        ['asignacion_asistencia_movilidad'],
        'linea'
      )
    ).toBeUndefined();
  });

  it('reads only the root when path is empty', () => {
    expect(
      resolveDependencyParentValue({ campo_qa: 'Test' }, [], 'campo_qa')
    ).toBe('Test');
  });

  it('uses localData (grid row) and skips the array at path', () => {
    const rootData = { items: [{ flag: 'x' }], flag: 'raiz' };
    expect(
      resolveDependencyParentValue(rootData, ['items'], 'flag', { flag: 'x' })
    ).toBe('x');
  });

  it('returns undefined and does not throw on invalid input', () => {
    expect(
      resolveDependencyParentValue(
        null,
        ['asignacion_asistencia_movilidad'],
        'linea'
      )
    ).toBeUndefined();
    expect(resolveDependencyParentValue([], [], 'linea')).toBeUndefined();
    expect(
      resolveDependencyParentValue(
        {},
        ['asignacion_asistencia_movilidad'],
        'linea'
      )
    ).toBeUndefined();
  });
});

describe('resolveDependencyParentScope', () => {
  it('labels a root hit as root when path is empty', () => {
    expect(
      resolveDependencyParentScope({ campo_qa: 'Test' }, [], 'campo_qa')
    ).toEqual({ value: 'Test', scope: 'root' });
  });

  it('labels a nested sibling hit as local', () => {
    expect(
      resolveDependencyParentScope(
        { asignacion_asistencia_movilidad: { linea: 'AUTOS' } },
        ['asignacion_asistencia_movilidad'],
        'linea'
      )
    ).toEqual({ value: 'AUTOS', scope: 'local' });
  });

  it('labels a fallback from a nested path onto root as ancestor', () => {
    expect(
      resolveDependencyParentScope(
        { linea: 'AUTOS', asignacion_asistencia_movilidad: {} },
        ['asignacion_asistencia_movilidad'],
        'linea'
      )
    ).toEqual({ value: 'AUTOS', scope: 'ancestor' });
  });

  it('labels a grid-row hit as local even when root has the same key', () => {
    expect(
      resolveDependencyParentScope(
        { items: [{ flag: 'x' }], flag: 'raiz' },
        ['items'],
        'flag',
        { flag: 'x' }
      )
    ).toEqual({ value: 'x', scope: 'local' });
  });

  it('returns none when the key is missing everywhere', () => {
    expect(resolveDependencyParentScope({}, ['contenedor'], 'linea')).toEqual({
      value: undefined,
      scope: 'none',
    });
  });
});
