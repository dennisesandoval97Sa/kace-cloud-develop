import { describe, it, expect, vi } from 'vitest';
import {
  freezeEditSnapshot,
  captureEditSnapshotDescription,
  refreshEditSnapshotAfterSave,
  clearEditSnapshot,
} from './editSnapshot.js';

function memStore(initial = {}) {
  const data = { ...initial };
  return {
    get: (k) => data[k],
    set: vi.fn((k, v) => {
      data[k] = v;
    }),
  };
}

describe('editSnapshot', () => {
  it('freezes a clone that later mutations do not affect', () => {
    const store = memStore();
    const caseObj = { transicion_id: 't1' };
    freezeEditSnapshot(store, {
      case: caseObj,
      auxData: { a: 1 },
      auxId: 'aux-1',
      description: undefined,
    });
    caseObj.transicion_id = 't9';
    expect(store.get('cases.edit_snapshot').case.transicion_id).toBe('t1');
    expect(store.get('cases.edit_snapshot').aux_cases).toEqual({
      id: 'aux-1',
      data: { a: 1 },
    });
  });

  it('captures description only once', () => {
    const store = memStore();
    freezeEditSnapshot(store, {
      case: {},
      auxData: {},
      description: undefined,
    });
    captureEditSnapshotDescription(store, '<p>one</p>');
    captureEditSnapshotDescription(store, '<p>two</p>');
    expect(store.get('cases.edit_snapshot').description).toBe('<p>one</p>');
  });

  it('refreshes from live after save and keeps stale case fields', () => {
    const store = memStore();
    freezeEditSnapshot(store, {
      case: { transicion_id: 't1', cliente_id: 'c1' },
      auxData: { formA: { a: 1 } },
      auxId: 'aux-1',
      description: '<p>old</p>',
    });

    refreshEditSnapshotAfterSave(store, {
      live: {
        case: {
          transicion_id: 't3',
          current_transicion_id: 't1',
          cliente_id: 'c2',
        },
        aux_cases: { id: 'aux-1', data: { formA: { a: 9 } } },
        description: '<p>new</p>',
      },
      rejectedCaseFields: ['transicion_id'],
    });

    const next = store.get('cases.edit_snapshot');
    expect(next.case).toEqual({ transicion_id: 't1', cliente_id: 'c2' });
    expect(next.aux_cases).toEqual({
      id: 'aux-1',
      data: { formA: { a: 9 } },
    });
    expect(next.description).toBe('<p>new</p>');
  });

  it('clears the leftover snapshot', () => {
    const store = memStore();
    freezeEditSnapshot(store, { case: { transicion_id: 't1' }, auxData: {} });
    clearEditSnapshot(store);
    expect(store.get('cases.edit_snapshot')).toBeNull();
  });
});
