import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockEvaluateKace } = vi.hoisted(() => ({
  mockEvaluateKace: vi.fn(),
}));

vi.mock('#plugins/kace/shared/evaluateKace.js', async (importOriginal) => {
  const actual = await importOriginal();
  mockEvaluateKace.mockImplementation(actual.evaluateKace);
  return {
    evaluateKace: mockEvaluateKace,
  };
});

import {
  createHideHelpers,
  evaluateStatesHideCode,
  filterVisibleStates,
  normalizeHideArgs,
} from './statesHide.helpers.js';

const STATES = [
  { state_id: 1, transition_id: 10, nombre: 'Abierto' },
  { state_id: 2, transition_id: 20, nombre: 'Escalado' },
  { state_id: 3, transition_id: 30, nombre: 'escalado' },
];

beforeEach(async () => {
  const actual = await vi.importActual('#plugins/kace/shared/evaluateKace.js');
  mockEvaluateKace.mockReset();
  mockEvaluateKace.mockImplementation(actual.evaluateKace);
});

describe('normalizeHideArgs', () => {
  it('wraps scalar in array', () => {
    expect(normalizeHideArgs(5)).toEqual([5]);
  });
  it('returns array as-is', () => {
    expect(normalizeHideArgs([1, 2])).toEqual([1, 2]);
  });
  it('returns empty for null/undefined', () => {
    expect(normalizeHideArgs(null)).toEqual([]);
    expect(normalizeHideArgs(undefined)).toEqual([]);
  });
});

describe('filterVisibleStates', () => {
  it('excludes by state_id', () => {
    const hiddenStateIds = new Set(['1']);
    const result = filterVisibleStates(STATES, hiddenStateIds, new Set());
    expect(result.map((s) => s.state_id)).toEqual([2, 3]);
  });
  it('excludes by transition_id', () => {
    const hiddenTransitionIds = new Set(['20']);
    const result = filterVisibleStates(STATES, new Set(), hiddenTransitionIds);
    expect(result.map((s) => s.state_id)).toEqual([1, 3]);
  });
});

describe('createHideHelpers', () => {
  it('hideById hides one or many', () => {
    const hiddenStateIds = new Set();
    const hiddenTransitionIds = new Set();
    const { hideById } = createHideHelpers(
      STATES,
      hiddenStateIds,
      hiddenTransitionIds
    );
    hideById(1);
    hideById([2, 3]);
    expect([...hiddenStateIds]).toEqual(['1', '2', '3']);
  });

  it('hideByName is case-insensitive and hides homonyms', () => {
    const hiddenStateIds = new Set();
    const hiddenTransitionIds = new Set();
    const { hideByName } = createHideHelpers(
      STATES,
      hiddenStateIds,
      hiddenTransitionIds
    );
    hideByName('ESCALADO');
    expect([...hiddenStateIds].sort()).toEqual(['2', '3']);
  });

  it('hideByName accepts an array of names', () => {
    const hiddenStateIds = new Set();
    const hiddenTransitionIds = new Set();
    const { hideByName } = createHideHelpers(
      STATES,
      hiddenStateIds,
      hiddenTransitionIds
    );
    hideByName(['Abierto', 'Escalado']);
    expect([...hiddenStateIds].sort()).toEqual(['1', '2', '3']);
  });

  it('hideByTransitionId hides by transition', () => {
    const hiddenStateIds = new Set();
    const hiddenTransitionIds = new Set();
    const { hideByTransitionId } = createHideHelpers(
      STATES,
      hiddenStateIds,
      hiddenTransitionIds
    );
    hideByTransitionId(10);
    hideByTransitionId([20]);
    expect([...hiddenTransitionIds].sort()).toEqual(['10', '20']);
  });
});

describe('evaluateStatesHideCode', () => {
  it('returns all states when code is empty', () => {
    expect(
      evaluateStatesHideCode({
        code: '',
        states: STATES,
        selected: null,
        defaultState: null,
        formData: {},
      })
    ).toEqual(STATES);
  });

  it('evaluates hide helpers from script', () => {
    const result = evaluateStatesHideCode({
      code: "hideById(1); hideByName('Escalado');",
      states: STATES,
      selected: null,
      defaultState: null,
      formData: { tipo: 'x' },
    });
    expect(result).toEqual([]);
  });

  it('fail-open on script error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockEvaluateKace.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const result = evaluateStatesHideCode({
      code: 'hideById(1);',
      states: STATES,
      selected: null,
      defaultState: null,
      formData: {},
    });
    expect(result).toEqual(STATES);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('ignores nonexistent state ids', () => {
    const result = evaluateStatesHideCode({
      code: 'hideById(999); hideByTransitionId(888);',
      states: STATES,
      selected: null,
      defaultState: null,
      formData: {},
    });
    expect(result).toEqual(STATES);
  });

  it('reevaluates cleanly when data changes', () => {
    const code = 'if (data.hide) hideById(1);';
    const visible = evaluateStatesHideCode({
      code,
      states: STATES,
      selected: null,
      defaultState: null,
      formData: { hide: false },
    });
    expect(visible.map((s) => s.state_id)).toEqual([1, 2, 3]);
    const hidden = evaluateStatesHideCode({
      code,
      states: STATES,
      selected: null,
      defaultState: null,
      formData: { hide: true },
    });
    expect(hidden.map((s) => s.state_id)).toEqual([2, 3]);
  });
});
