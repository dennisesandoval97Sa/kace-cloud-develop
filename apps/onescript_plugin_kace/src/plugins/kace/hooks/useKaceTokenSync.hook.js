import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { KaceEngine } from '../KaceEngine.js';
import { storeService } from '#plugins/kace/services/storeService.js';
import { mergeKaceSessionTokensBundle } from '#plugins/kace/services/sessionStorageCache.js';
import {
  setApplyTokensFromParent,
  setRequestReinitFromParent,
} from '../shared/kaceParentTokenBridge.js';

const REINIT_TIMEOUT_MS = 5000;

function applyParentTokenPayload(payload) {
  const tokens = payload?.tokens;
  if (!tokens || typeof tokens !== 'object') return;

  const refreshToken =
    payload.refresh_token ?? payload.params?.refresh_token ?? null;
  const idToken = tokens.id_token ?? null;
  const accessToken = tokens.access_token ?? null;
  const tokenType = tokens.token_type ?? null;
  const expiresIn =
    tokens.expires_in != null ? Number(tokens.expires_in) : null;

  try {
    const authService = KaceEngine().getService('authService');
    authService?.setTokens?.({
      accessToken,
      refreshToken,
      idToken,
      tokenType,
      expiresIn,
    });
  } catch (_) {}

  try {
    if (refreshToken) storeService.set('auth.refresh_token', refreshToken);
    if (idToken) storeService.set('auth.id_token', idToken);
    if (accessToken) storeService.set('auth.access_token', accessToken);
    if (tokenType) storeService.set('auth.token_type', tokenType);
    if (expiresIn != null) storeService.set('auth.expires_in', expiresIn);
  } catch (_) {}

  try {
    mergeKaceSessionTokensBundle({
      ...(idToken ? { 'auth.id_token': idToken } : {}),
      ...(accessToken ? { 'auth.access_token': accessToken } : {}),
      ...(tokenType ? { 'auth.token_type': tokenType } : {}),
      ...(expiresIn != null ? { 'auth.expires_in': String(expiresIn) } : {}),
      ...(refreshToken ? { 'auth.refresh_token': refreshToken } : {}),
    });
  } catch (_) {}
}

export function useKaceTokenSync(enabled = false) {
  useEffect(() => {
    if (!enabled) return;

    function requestReinit() {
      return new Promise((resolve, reject) => {
        const requestId = uuidv4();
        const timer = setTimeout(() => {
          window.removeEventListener('message', reinitHandler);
          reject(new Error('timeout'));
        }, REINIT_TIMEOUT_MS);

        function reinitHandler(event) {
          if (event.source !== window.parent) return;
          if (event.data?.type !== 'KACE_REINIT_RESPONSE') return;
          if (event.data?.requestId !== requestId) return;

          clearTimeout(timer);
          window.removeEventListener('message', reinitHandler);
          applyParentTokenPayload(event.data);
          resolve();
        }

        window.addEventListener('message', reinitHandler);
        window.parent.postMessage(
          { type: 'KACE_REINIT_REQUEST', requestId },
          '*'
        );
      });
    }

    setApplyTokensFromParent(applyParentTokenPayload);
    setRequestReinitFromParent(requestReinit);

    function tokensUpdatedHandler(event) {
      if (event.source !== window.parent) return;
      if (event.data?.type !== 'KACE_TOKENS_UPDATED') return;
      applyParentTokenPayload(event.data);
    }

    window.addEventListener('message', tokensUpdatedHandler);

    return () => {
      window.removeEventListener('message', tokensUpdatedHandler);
      setApplyTokensFromParent(null);
      setRequestReinitFromParent(null);
    };
  }, [enabled]);
}
