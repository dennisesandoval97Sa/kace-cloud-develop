import { storeService } from '#plugins/kace/services/storeService.js';
import { SessionStorageCache } from '#plugins/kace/services/sessionStorageCache.js';

export const STORE_PATH_AUTH_COGNITO_RESPONSE = 'auth.auth_cognito_response';
export const STORE_PATH_HANDSHAKE_PARAMS = 'auth.handshake_params';

export function getAuthCognitoResponse() {
  try {
    const fromStore = storeService.get(STORE_PATH_AUTH_COGNITO_RESPONSE);
    if (fromStore != null && typeof fromStore === 'object') {
      return fromStore;
    }
  } catch (_) {}

  try {
    const cached = SessionStorageCache.peek('auth-cognito', 'default');
    const fromCache = cached?.data ?? null;
    if (fromCache != null && typeof fromCache === 'object') {
      return fromCache;
    }
  } catch (_) {}

  try {
    const userData = storeService.get('user.user_data');
    if (userData != null && typeof userData === 'object') {
      return userData;
    }
  } catch (_) {}

  return null;
}

export function getHandshakeParams() {
  try {
    const fromStore = storeService.get(STORE_PATH_HANDSHAKE_PARAMS);
    if (fromStore != null && typeof fromStore === 'object') {
      return fromStore;
    }
  } catch (_) {}
  return null;
}

export function withHandshakeEvaluatorContext(context = {}) {
  if (context == null || typeof context !== 'object') {
    return {
      params: getHandshakeParams(),
      authCognitoResponse: getAuthCognitoResponse(),
    };
  }
  const enriched = { ...context };
  if (enriched.params == null) {
    enriched.params = getHandshakeParams();
  }
  if (enriched.authCognitoResponse == null) {
    enriched.authCognitoResponse = getAuthCognitoResponse();
  }
  return enriched;
}
