import { describe, expect, it, vi } from 'vitest';
import { applyCaseEditLock } from './applyCaseEditLock.js';

describe('applyCaseEditLock', () => {
  it('returns early when locked is false', () => {
    const root = { everyComponent: vi.fn() };
    expect(applyCaseEditLock(root, { locked: false })).toEqual({
      appliedCount: 0,
      skipped: 'not-locked',
    });
    expect(root.everyComponent).not.toHaveBeenCalled();
  });

  it('skips auth component and disables others', () => {
    const authSetDisabled = vi.fn();
    const submitSetDisabled = vi.fn();
    const components = [
      { component: { type: 'auth' }, setDisabled: authSetDisabled },
      { component: { type: 'kace_submit' }, setDisabled: submitSetDisabled },
      { component: { type: 'classification_id' }, setDisabled: vi.fn() },
    ];
    const root = {
      everyComponent(fn) {
        components.forEach(fn);
      },
    };

    const result = applyCaseEditLock(root, { locked: true });

    expect(authSetDisabled).not.toHaveBeenCalled();
    expect(submitSetDisabled).toHaveBeenCalledWith(true);
    expect(result.appliedCount).toBe(2);
  });

  it('uses globalRoot when present', () => {
    const setDisabled = vi.fn();
    const globalRoot = {
      everyComponent(fn) {
        fn({ component: { type: 'states' }, setDisabled });
      },
    };
    const formRoot = { globalRoot };

    applyCaseEditLock(formRoot, { locked: true });

    expect(setDisabled).toHaveBeenCalledWith(true);
  });
});
