import { describe, it, expect } from 'vitest';
import { buildDirtyAuxiliaryPayload } from './buildDirtyAuxiliaryPayload.js';

const snap = {
  case: {
    cliente_id: 'c1',
    transicion_id: 't1',
    clasificacion_id: 'cl1',
    responsable_id: 'r1',
    grupo_id: 'g1',
    parent_id: 'p1',
    descripcion_caso_id: 'd1',
  },
  aux_cases: { data: { formA: { a: 1, b: 2 } } },
  description: '<p>hello</p>',
};

describe('buildDirtyAuxiliaryPayload', () => {
  it('returns empty envelope when nothing changed', () => {
    const live = {
      case: { ...snap.case, current_transicion_id: 't1' },
      aux_cases: { data: { formA: { a: 1, b: 2 } } },
      description: '<p>hello</p>',
    };
    expect(buildDirtyAuxiliaryPayload(live, snap)).toEqual({
      case: {},
      aux_cases: {},
    });
  });

  it('sends only dirty case keys and current_* from snapshot', () => {
    const live = {
      case: {
        ...snap.case,
        transicion_id: 't2',
        current_transicion_id: 'mutated',
      },
      aux_cases: { data: { formA: { a: 1, b: 2 } } },
      description: '<p>hello</p>',
    };
    expect(buildDirtyAuxiliaryPayload(live, snap)).toEqual({
      case: { transicion_id: 't2', current_transicion_id: 't1' },
      aux_cases: {},
    });
  });

  it('sends current_responsable_id when responsable_id is dirty', () => {
    const live = {
      case: { ...snap.case, responsable_id: 'r2' },
      aux_cases: { data: snap.aux_cases.data },
      description: snap.description,
    };
    expect(buildDirtyAuxiliaryPayload(live, snap).case).toEqual({
      responsable_id: 'r2',
      current_responsable_id: 'r1',
    });
  });

  it('emits current_* for cliente, clasificacion and grupo when they are dirty', () => {
    const live = {
      case: {
        ...snap.case,
        cliente_id: 'c2',
        clasificacion_id: 'cl2',
        grupo_id: 'g2',
      },
      aux_cases: { data: snap.aux_cases.data },
      description: snap.description,
    };
    expect(buildDirtyAuxiliaryPayload(live, snap).case).toEqual({
      cliente_id: 'c2',
      current_cliente_id: 'c1',
      clasificacion_id: 'cl2',
      current_clasificacion_id: 'cl1',
      grupo_id: 'g2',
      current_grupo_id: 'g1',
    });
  });

  it('sends several dirty base fields with their current_* snapshots', () => {
    const live = {
      case: {
        ...snap.case,
        transicion_id: 't2',
        responsable_id: 'r2',
        cliente_id: 'c2',
      },
      aux_cases: { data: snap.aux_cases.data },
      description: snap.description,
    };
    expect(buildDirtyAuxiliaryPayload(live, snap).case).toEqual({
      transicion_id: 't2',
      current_transicion_id: 't1',
      responsable_id: 'r2',
      current_responsable_id: 'r1',
      cliente_id: 'c2',
      current_cliente_id: 'c1',
    });
  });

  it('sends null when a case field is cleared', () => {
    const live = {
      case: { ...snap.case, parent_id: null },
      aux_cases: { data: snap.aux_cases.data },
      description: snap.description,
    };
    expect(buildDirtyAuxiliaryPayload(live, snap).case).toEqual({
      parent_id: null,
    });
  });

  it('does not treat a key omitted from live as a delete', () => {
    const { parent_id, ...caseWithoutParent } = snap.case;
    const live = {
      case: caseWithoutParent,
      aux_cases: { data: { formA: { a: 1, b: 2 } } },
      description: snap.description,
    };
    expect(buildDirtyAuxiliaryPayload(live, snap)).toEqual({
      case: {},
      aux_cases: {},
    });
    expect(parent_id).toBe('p1');
  });

  it('sends sparse dirty nested aux objects and whole dirty arrays', () => {
    const snapshot = {
      ...snap,
      aux_cases: {
        data: { formA: { a: 1, b: 2, tags: ['x'] }, formB: { c: 3 } },
      },
    };
    const live = {
      case: snap.case,
      aux_cases: {
        id: 'aux-1',
        data: { formA: { a: 9, b: 2, tags: ['x', 'y'] }, formB: { c: 3 } },
      },
      description: snap.description,
    };
    expect(buildDirtyAuxiliaryPayload(live, snapshot)).toEqual({
      case: {},
      aux_cases: {
        id: 'aux-1',
        data: { formA: { a: 9, tags: ['x', 'y'] } },
      },
    });
  });

  it('falls back to snapshot aux id and throws if dirty aux data has no id', () => {
    const snapshot = {
      ...snap,
      aux_cases: { id: 'aux-from-snap', data: { formA: { a: 1 } } },
    };
    const liveWithSnapId = {
      case: snap.case,
      aux_cases: { data: { formA: { a: 9 } } },
      description: snap.description,
    };
    expect(
      buildDirtyAuxiliaryPayload(liveWithSnapId, snapshot).aux_cases.id
    ).toBe('aux-from-snap');

    const liveWithoutId = {
      case: snap.case,
      aux_cases: { data: { formA: { a: 9 } } },
      description: snap.description,
    };
    expect(() => buildDirtyAuxiliaryPayload(liveWithoutId, snap)).toThrow(
      'No se pudo guardar la información auxiliar del caso. Recargue el formulario e intente de nuevo.'
    );
  });

  it('omits description when HTML is unchanged and includes it when changed', () => {
    const liveSame = {
      case: snap.case,
      aux_cases: { data: snap.aux_cases.data },
      description: snap.description,
    };
    expect(buildDirtyAuxiliaryPayload(liveSame, snap)).not.toHaveProperty(
      'description'
    );
    const liveDiff = { ...liveSame, description: '<p>bye</p>' };
    expect(buildDirtyAuxiliaryPayload(liveDiff, snap).description).toEqual({
      id: 'd1',
      descripcion: '<p>bye</p>',
    });
  });

  it('sends description when the snapshot has no description key', () => {
    const { description, ...snapshotWithoutDescription } = snap;
    const live = {
      case: snap.case,
      aux_cases: { data: snap.aux_cases.data },
      description: '<p>nuevo</p>',
    };
    expect(
      buildDirtyAuxiliaryPayload(live, snapshotWithoutDescription).description
    ).toEqual({
      id: 'd1',
      descripcion: '<p>nuevo</p>',
    });
    expect(description).toBe('<p>hello</p>');
  });

  it('treats distinct Date values as dirty and equal Dates as clean', () => {
    const snapshot = {
      ...snap,
      aux_cases: {
        id: 'aux-1',
        data: { formA: { d: new Date('2020-01-01') } },
      },
    };
    const liveDirty = {
      case: snap.case,
      aux_cases: {
        id: 'aux-1',
        data: { formA: { d: new Date('2026-09-01') } },
      },
      description: snap.description,
    };
    expect(
      buildDirtyAuxiliaryPayload(liveDirty, snapshot).aux_cases.data.formA.d
    ).toEqual(new Date('2026-09-01'));

    const liveSame = {
      case: snap.case,
      aux_cases: {
        id: 'aux-1',
        data: { formA: { d: new Date('2020-01-01') } },
      },
      description: snap.description,
    };
    expect(buildDirtyAuxiliaryPayload(liveSame, snapshot).aux_cases).toEqual(
      {}
    );
  });

  it('does not mark NaN as dirty against itself', () => {
    const snapshot = {
      ...snap,
      aux_cases: { id: 'aux-1', data: { formA: { n: NaN } } },
    };
    const live = {
      case: snap.case,
      aux_cases: { id: 'aux-1', data: { formA: { n: NaN } } },
      description: snap.description,
    };
    expect(buildDirtyAuxiliaryPayload(live, snapshot).aux_cases).toEqual({});
  });

  it('does not mutate live or snapshot', () => {
    const live = {
      case: { ...snap.case, cliente_id: 'c9' },
      aux_cases: { data: {} },
      description: '',
    };
    const snapCopy = structuredClone(snap);
    const liveCopy = structuredClone(live);
    buildDirtyAuxiliaryPayload(live, snap);
    expect(live).toEqual(liveCopy);
    expect(snap).toEqual(snapCopy);
  });

  it('returns a backend-shaped envelope when snapshot is missing', () => {
    const live = {
      case: { cliente_id: 'c1' },
      aux_cases: { caso_id: 'should-drop', id: 'aux-1', data: { z: 1 } },
      description: 'x',
    };
    expect(buildDirtyAuxiliaryPayload(live, null)).toEqual({
      case: { cliente_id: 'c1' },
      aux_cases: { id: 'aux-1', data: { z: 1 } },
      description: { id: undefined, descripcion: 'x' },
    });
  });
});
