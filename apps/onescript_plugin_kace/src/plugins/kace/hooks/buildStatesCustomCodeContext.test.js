import { describe, expect, it, vi } from 'vitest';
import {
  buildStatesCustomCodeContext,
  resolveStatesEmit,
} from './buildStatesCustomCodeContext.js';

vi.mock('../KaceEngine.js', () => ({
  KaceEngine: vi.fn(() => ({
    getService: (name) => {
      if (name === 'storeService') {
        return {
          get: (key) => (key === 'config.api_url' ? 'https://api.test' : null),
        };
      }
      if (name === 'apiService') {
        return { apiUrl: 'https://api.test' };
      }
      return null;
    },
  })),
}));

describe('buildStatesCustomCodeContext', () => {
  it('exposes kace context and states helpers', () => {
    const emit = vi.fn();
    const root = {
      data: { foo: 1 },
      globalRoot: { data: { case: 'x' }, emit },
      emit,
    };
    const handleChange = vi.fn();
    const handleState = vi.fn();
    const hideById = vi.fn();

    const ctx = buildStatesCustomCodeContext({
      root,
      states: [{ state_id: 1, transition_id: 10, nombre: 'A' }],
      selected: 1,
      defaultState: { state_id: 2, nombre: 'B' },
      handleChange,
      handleState,
      hideHelpers: { hideById },
    });

    expect(ctx.data).toEqual({ foo: 1 });
    expect(ctx.row).toBe(ctx.data);
    expect(ctx.globalData).toEqual({ case: 'x' });
    expect(ctx.kaceEngine).toBeTruthy();
    expect(ctx.apiService).toBeTruthy();
    expect(ctx.url_api).toBe('https://api.test');
    expect(ctx.handleChange).toBe(handleChange);
    expect(ctx.handleState).toBe(handleState);
    expect(ctx.hideById).toBe(hideById);
    expect(ctx.states).toHaveLength(1);
    expect(typeof ctx.setData).toBe('function');
    expect(typeof ctx.emit).toBe('function');
  });

  it('setData merges into root and emits change', () => {
    const emit = vi.fn();
    const root = { data: { a: 1 }, submission: { data: { a: 1 } }, emit };
    const ctx = buildStatesCustomCodeContext({
      root,
      states: [],
      selected: null,
      defaultState: null,
      handleChange: vi.fn(),
      handleState: vi.fn(),
    });
    ctx.setData({ b: 2 });
    expect(root.data).toEqual({ a: 1, b: 2 });
    expect(emit).toHaveBeenCalled();
  });
});

describe('resolveStatesEmit', () => {
  it('prefers globalRoot emit', () => {
    const globalEmit = vi.fn();
    const root = { emit: vi.fn(), globalRoot: { emit: globalEmit } };
    const resolved = resolveStatesEmit(root);
    expect(resolved).toBeTypeOf('function');
    resolved('test');
    expect(globalEmit).toHaveBeenCalledWith('test');
  });
});
