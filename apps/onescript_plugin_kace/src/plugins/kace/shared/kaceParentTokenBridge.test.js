import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  setEmbeddedInKace,
  isEmbeddedInKace,
  setApplyTokensFromParent,
  applyTokensFromParentPayload,
  setRequestReinitFromParent,
  requestReinitFromParent,
  waitForValidTokenFromParent,
} from './kaceParentTokenBridge.js';

describe('kaceParentTokenBridge', () => {
  afterEach(() => {
    setEmbeddedInKace(false);
    setApplyTokensFromParent(null);
    setRequestReinitFromParent(null);
    vi.useRealTimers();
  });

  it('tracks embedded mode', () => {
    setEmbeddedInKace(true);
    expect(isEmbeddedInKace()).toBe(true);
    setEmbeddedInKace(false);
    expect(isEmbeddedInKace()).toBe(false);
  });

  it('delegates apply and reinit to registered handlers', async () => {
    const apply = vi.fn();
    const reinit = vi.fn().mockResolvedValue(undefined);
    setApplyTokensFromParent(apply);
    setRequestReinitFromParent(reinit);

    applyTokensFromParentPayload({
      tokens: { id_token: 'x' },
      refresh_token: 'rt',
    });
    expect(apply).toHaveBeenCalledWith({
      tokens: { id_token: 'x' },
      refresh_token: 'rt',
    });

    await requestReinitFromParent();
    expect(reinit).toHaveBeenCalled();
  });

  it('rejects requestReinitFromParent when no handler is registered', async () => {
    await expect(requestReinitFromParent()).rejects.toThrow(
      'Reinit handler not registered'
    );
  });

  it('waitForValidTokenFromParent resolves when predicate returns true', async () => {
    let valid = false;
    setApplyTokensFromParent(() => {
      valid = true;
    });

    const promise = waitForValidTokenFromParent({
      isValid: () => valid,
      timeoutMs: 500,
      requestReinit: vi.fn().mockResolvedValue(undefined),
    });

    valid = true;
    await expect(promise).resolves.toBeUndefined();
  });

  it('waitForValidTokenFromParent calls requestReinit after initial timeout then resolves', async () => {
    vi.useFakeTimers();
    let valid = false;
    const requestReinit = vi.fn().mockImplementation(async () => {
      valid = true;
    });

    const promise = waitForValidTokenFromParent({
      isValid: () => valid,
      timeoutMs: 200,
      requestReinit,
    });

    await vi.advanceTimersByTimeAsync(250);
    await promise;

    expect(requestReinit).toHaveBeenCalled();
  });

  it('waitForValidTokenFromParent throws when tokens never become valid', async () => {
    vi.useFakeTimers();

    const promise = waitForValidTokenFromParent({
      isValid: () => false,
      timeoutMs: 200,
      requestReinit: vi.fn().mockResolvedValue(undefined),
    });

    const expectation = expect(promise).rejects.toThrow(
      'Timed out waiting for parent tokens'
    );
    await vi.advanceTimersByTimeAsync(7200);
    await expectation;
  });
});
