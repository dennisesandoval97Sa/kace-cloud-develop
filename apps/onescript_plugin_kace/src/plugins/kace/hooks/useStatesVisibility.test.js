import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  SCHEMA_KEY_STATES_HIDE_CODE,
  SCHEMA_KEY_STATES_ON_CHANGE_CODE,
} from '#plugins/kace/shared/kace-events.constants.js';
import useStatesVisibility from './useStatesVisibility.js';

const { mockEvaluateKace } = vi.hoisted(() => ({
  mockEvaluateKace: vi.fn(),
}));

vi.mock('#plugins/kace/shared/evaluateKace.js', async (importOriginal) => {
  const actual = await importOriginal();
  mockEvaluateKace.mockImplementation(actual.evaluateKace);
  return { evaluateKace: mockEvaluateKace };
});

vi.mock('../KaceEngine.js', () => ({
  KaceEngine: vi.fn(() => ({
    getService: () => null,
  })),
}));

beforeEach(async () => {
  const actual = await vi.importActual('#plugins/kace/shared/evaluateKace.js');
  mockEvaluateKace.mockReset();
  mockEvaluateKace.mockImplementation(actual.evaluateKace);
});

const STATES = [
  { state_id: 1, transition_id: 10, nombre: 'Abierto' },
  { state_id: 2, transition_id: 20, nombre: 'Cerrado' },
];

describe('useStatesVisibility', () => {
  it('returns all states when no code configured', () => {
    const { result } = renderHook(() =>
      useStatesVisibility({
        root: null,
        component: {},
        states: STATES,
        selected: null,
        defaultState: null,
      })
    );
    expect(result.current.visibleStates).toEqual(STATES);
  });

  it('reevaluates on root change event', () => {
    const listeners = {};
    const root = {
      data: { flag: false },
      on: (event, cb) => {
        listeners[event] = cb;
      },
      off: (event) => {
        delete listeners[event];
      },
    };
    const component = {
      [SCHEMA_KEY_STATES_ON_CHANGE_CODE]: 'if (data.flag) hideById(1);',
    };
    const { result } = renderHook(() =>
      useStatesVisibility({
        root,
        component,
        states: STATES,
        selected: null,
        defaultState: null,
      })
    );
    expect(result.current.visibleStates.map((s) => s.state_id)).toEqual([1, 2]);
    act(() => {
      root.data.flag = true;
      listeners.change?.();
    });
    expect(result.current.visibleStates.map((s) => s.state_id)).toEqual([2]);
  });

  it('supports legacy hideStatesCode as onChange fallback', () => {
    const root = { data: { x: 1 } };
    const { result } = renderHook(() =>
      useStatesVisibility({
        root,
        component: {
          [SCHEMA_KEY_STATES_HIDE_CODE]: 'hideById(2);',
        },
        states: STATES,
        selected: null,
        defaultState: null,
      })
    );
    expect(result.current.visibleStates.map((s) => s.state_id)).toEqual([1]);
  });
});
