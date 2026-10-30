import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setEmbeddedInKace,
  setRequestReinitFromParent,
} from '#plugins/kace/shared/kaceParentTokenBridge.js';
import { showOAuthRefreshFatalOverlay } from './oauthRefreshFatalOverlay.js';

describe('showOAuthRefreshFatalOverlay', () => {
  let reloadMock;
  let originalLocation;

  beforeEach(() => {
    document.body.innerHTML = '';
    setEmbeddedInKace(false);
    setRequestReinitFromParent(null);
    sessionStorage.setItem('test', '1');
    localStorage.setItem('test', '1');
    originalLocation = window.location;
    reloadMock = vi.fn();
    delete window.location;
    window.location = { ...originalLocation, reload: reloadMock };
  });

  afterEach(() => {
    setEmbeddedInKace(false);
    setRequestReinitFromParent(null);
    window.location = originalLocation;
    document.body.innerHTML = '';
  });

  it('iframe mode: click calls requestReinitFromParent, no clear/reload, overlay removed on success', async () => {
    const reinit = vi.fn().mockResolvedValue(undefined);
    setEmbeddedInKace(true);
    setRequestReinitFromParent(reinit);

    showOAuthRefreshFatalOverlay('test message');

    const btn = document.querySelector('#kace-oauth-fatal-overlay button');
    btn.click();

    await vi.waitFor(() => {
      expect(reinit).toHaveBeenCalled();
    });

    expect(sessionStorage.getItem('test')).toBe('1');
    expect(localStorage.getItem('test')).toBe('1');
    expect(reloadMock).not.toHaveBeenCalled();
    expect(document.getElementById('kace-oauth-fatal-overlay')).toBeNull();
  });

  it('standalone: clear storage and reload', () => {
    setEmbeddedInKace(false);

    showOAuthRefreshFatalOverlay();

    const btn = document.querySelector('#kace-oauth-fatal-overlay button');
    btn.click();

    expect(sessionStorage.getItem('test')).toBeNull();
    expect(localStorage.getItem('test')).toBeNull();
    expect(reloadMock).toHaveBeenCalled();
  });
});
