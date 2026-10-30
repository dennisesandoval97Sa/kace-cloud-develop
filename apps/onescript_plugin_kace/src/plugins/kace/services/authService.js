import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { showOAuthRefreshFatalOverlay } from '#plugins/kace/utils/oauthRefreshFatalOverlay.js';
import {
  isEmbeddedInKace,
  requestReinitFromParent,
  waitForValidTokenFromParent,
} from '#plugins/kace/shared/kaceParentTokenBridge.js';
import {
  clearKaceSessionTokensBundle,
  getKaceSessionTokensBundle,
  mergeKaceSessionTokensBundle,
} from './sessionStorageCache.js';

/** Intentos al endpoint oauth2/token ante error recuperable (p. ej. invalid_grant): 1 inicial + 3 reintentos */
const MAX_OAUTH_REFRESH_ATTEMPTS = 4;

/**
 * @returns {string|null}
 */
function getRefreshTokenFromUrl() {
  try {
    if (typeof window === 'undefined' || !window.location?.search) return null;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('refresh_token') || params.get('token');
    return t ? String(t) : null;
  } catch (_) {
    return null;
  }
}

/**
 * @param {unknown} data
 * @returns {Record<string, string>}
 */
function normalizeOAuthErrorBody(data) {
  if (data == null) return {};
  if (typeof data === 'string') {
    try {
      const p = JSON.parse(data);
      return p && typeof p === 'object' ? p : {};
    } catch (_) {
      return {};
    }
  }
  return typeof data === 'object' ? data : {};
}

/**
 * invalid_grant u otros errores OAuth donde conviene limpiar sesión y reintentar con el token de la URL.
 * @param {unknown} error
 * @returns {boolean}
 */
function isAxiosLikeError(error) {
  return Boolean(
    error && typeof error === 'object' && error.response && error.config
  );
}

function isRecoverableOAuthGrantError(error) {
  if (!isAxiosLikeError(error)) return false;
  const status = error.response.status;
  if (status !== 400 && status !== 401) return false;
  const body = normalizeOAuthErrorBody(error.response.data);
  const code = String(body.error || '').toLowerCase();
  if (code === 'invalid_grant' || code === 'invalid_token') return true;
  const desc = String(body.error_description || '').toLowerCase();
  if (desc.includes('invalid_grant')) return true;
  if (
    desc.includes('refresh') &&
    (desc.includes('invalid') ||
      desc.includes('expired') ||
      desc.includes('revoked'))
  ) {
    return true;
  }
  return false;
}

/**
 * Texto claro para usuario final (evita códigos tipo invalid_grant sin contexto).
 * @param {unknown} error
 * @returns {string}
 */
function formatOAuthErrorForUser(error) {
  const body = isAxiosLikeError(error)
    ? normalizeOAuthErrorBody(error.response?.data)
    : {};
  const code = String(body.error || '')
    .toLowerCase()
    .trim();
  const rawDesc =
    typeof body.error_description === 'string'
      ? body.error_description.trim()
      : '';

  const byOAuthCode = {
    invalid_grant:
      'El acceso temporal caducó o dejó de ser válido. Suele pasar si pasó mucho tiempo, si ya usó el acceso en otro equipo o si cerró la sesión en la aplicación principal. Puede usar el botón inferior para reiniciar el formulario.',
    invalid_token:
      'La sesión dejó de ser válida. Presione el botón inferior para reiniciar el formulario.',
    unauthorized_client:
      'No se pudo completar el inicio de sesión con la configuración actual del sistema. Contacte a soporte informático o a quien administra la integración.',
    invalid_scope:
      'No se pudo autorizar el acceso solicitado. Debe volver a entrar desde la aplicación principal, con los permisos que le asigne su organización. Puede usar el botón inferior para reiniciar el formulario.',
    access_denied:
      'El acceso fue rechazado. Compruebe con la aplicación principal que la dirección y los permisos son los correctos, o solicite un nuevo acceso. Puede usar el botón inferior para reiniciar el formulario.',
  };

  if (code && byOAuthCode[code]) {
    return byOAuthCode[code];
  }

  // Descripción en inglés de Cognito u otros: intentar dar contexto sin solo repetir códigos
  if (rawDesc) {
    const lower = rawDesc.toLowerCase();
    if (
      lower.includes('refresh') &&
      (lower.includes('expired') ||
        lower.includes('revoked') ||
        lower.includes('invalid'))
    ) {
      return byOAuthCode.invalid_grant;
    }
    if (lower.includes('invalid_grant') || rawDesc === 'invalid_grant') {
      return byOAuthCode.invalid_grant;
    }
    // Evitar mostrar solo un código técnico suelto
    if (!/^invalid_[a-z_]+$/i.test(rawDesc) && rawDesc.length > 12) {
      return `${rawDesc} Si el problema continúa, recargue la página o use el botón inferior para reiniciar el formulario.`;
    }
  }

  if (
    error instanceof Error &&
    error.message &&
    !/^Request failed with status code \d+$/.test(error.message)
  ) {
    return `${error.message} Si el mensaje continúa, use el botón inferior para reiniciar el formulario.`;
  }

  return 'No pudimos mantener la sesión de forma segura. Presione el botón inferior para reiniciar el formulario.';
}

export class AuthService {
  /**
   * @returns {Record<string, string>|null}
   */
  getSessionTokensBundle() {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      return getKaceSessionTokensBundle();
    } catch (_) {
      return null;
    }
  }

  /**
   * @param {Record<string, string>} nextTokens
   * @returns {void}
   */
  setSessionTokensBundle(nextTokens) {
    try {
      if (typeof sessionStorage === 'undefined') return;
      mergeKaceSessionTokensBundle(nextTokens);
    } catch (_) {
      // ignore
    }
  }

  /**
   * Reads a token value from sessionStorage.
   * @param {string} key
   * @returns {string|null}
   */
  getSessionToken(key) {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const fromBundle = this.getSessionTokensBundle()?.[key];
      if (fromBundle != null) return String(fromBundle);
      return sessionStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  /**
   * Keeps in-memory tokens synced with sessionStorage values.
   * @returns {void}
   */
  hydrateTokensFromSessionStorage() {
    const sessionIdToken = this.getSessionToken('auth.id_token');
    const sessionAccessToken = this.getSessionToken('auth.access_token');
    const sessionTokenType = this.getSessionToken('auth.token_type');
    const sessionExpiresIn = this.getSessionToken('auth.expires_in');
    const sessionRefreshToken = this.getSessionToken('auth.refresh_token');

    if (sessionIdToken) this.idToken = sessionIdToken;
    if (sessionAccessToken) this.accessToken = sessionAccessToken;
    if (sessionTokenType) this.tokenType = sessionTokenType;
    if (sessionExpiresIn != null && sessionExpiresIn !== '')
      this.expiresIn = Number(sessionExpiresIn);
    if (sessionRefreshToken) this.refreshToken = sessionRefreshToken;
  }

  /**
   * @param {Object} params
   * @param {string} params.apiUrl
   * @param {string} params.clientId
   * @param {string} params.tenantId
   * @param {string} params.fingerprint
   * @param {string} params.cognitoClientId
   * @param {string} params.cognitoUrl
   * @param {string|null} params.refreshToken
   * @param {import('./storeService').StoreService|null} [params.storeService=null]
   */
  constructor({
    apiUrl,
    clientId,
    tenantId,
    fingerprint,
    cognitoClientId,
    cognitoUrl,
    refreshToken,
    storeService = null,
  }) {
    this.apiUrl = apiUrl;
    this.clientId = clientId;
    this.tenantId = tenantId;
    this.fingerprint = fingerprint;
    this.cognitoClientId = cognitoClientId;
    this.cognitoUrl = cognitoUrl;
    this.refreshToken = refreshToken;
    this.storeService = storeService;

    this.idToken = null;
    this.accessToken = null;
    this.tokenType = null;
    this.expiresIn = null;
    this._refreshPromise = null;
  }

  /**
   * Elimina solo el bundle JSON en sessionStorage (p. ej. antes de reintentar oauth2/token).
   * @returns {void}
   */
  clearSessionTokensBundleStorage() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        clearKaceSessionTokensBundle();
      }
    } catch (_) {
      // ignore
    }
  }

  isIdTokenValidLocal(marginMs = 10000) {
    if (!this.idToken) return false;
    try {
      const decoded = jwtDecode(this.idToken);
      const expiration = decoded.exp * 1000;
      const now = Date.now();
      const timeLeft = expiration - now;
      return timeLeft > marginMs;
    } catch (_) {
      return false;
    }
  }

  /**
   * Refresh tokens using the refresh token (Cognito). Reintenta hasta 3 veces ante invalid_grant
   * limpiando el bundle de tokens en SessionStorageCache y tomando de nuevo el refresh token de la URL.
   * @returns {Promise<{idToken: string, accessToken: string, tokenType: string, expiresIn: number}>}
   */
  async refreshTokenFlow() {
    this.hydrateTokensFromSessionStorage();

    if (isEmbeddedInKace()) {
      if (this._refreshPromise) {
        return this._refreshPromise;
      }

      this._refreshPromise = (async () => {
        try {
          await waitForValidTokenFromParent({
            isValid: () => this.isIdTokenValidLocal(),
            timeoutMs: 2000,
            requestReinit: () => requestReinitFromParent(),
          });
          this.hydrateTokensFromSessionStorage();
          return {
            idToken: this.idToken,
            accessToken: this.accessToken,
            tokenType: this.tokenType,
            expiresIn: this.expiresIn,
          };
        } finally {
          this._refreshPromise = null;
        }
      })();

      return this._refreshPromise;
    }

    const urlRefresh = getRefreshTokenFromUrl();
    if (!this.refreshToken && urlRefresh) {
      this.refreshToken = urlRefresh;
    }
    if (!this.refreshToken)
      throw new Error('No hay token de actualización disponible');

    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    this._refreshPromise = (async () => {
      try {
        let lastError = null;

        for (let attempt = 0; attempt < MAX_OAUTH_REFRESH_ATTEMPTS; attempt++) {
          if (attempt > 0) {
            this.clearSessionTokensBundleStorage();
            const rtFromUrl = getRefreshTokenFromUrl();
            if (!rtFromUrl) {
              const msg =
                'No pudimos renovar la sesión. Puede usar el botón inferior para reiniciar el formulario.';
              try {
                showOAuthRefreshFatalOverlay(msg);
                if (typeof document !== 'undefined') {
                  document.dispatchEvent(
                    new CustomEvent('kaceOAuthRefreshFailed', {
                      detail: {
                        message: msg,
                        reason: 'missing_url_refresh_token',
                      },
                    })
                  );
                }
              } catch (_) {
                // ignore
              }
              throw lastError ?? new Error(msg);
            }
            this.refreshToken = rtFromUrl;
            try {
              if (
                this.storeService &&
                typeof this.storeService.set === 'function'
              ) {
                this.storeService.set('auth.refresh_token', rtFromUrl);
              }
            } catch (_) {
              // ignore
            }
          }

          try {
            const configuration = {
              grant_type: 'refresh_token',
              client_id: this.cognitoClientId,
              refresh_token: this.refreshToken,
            };

            const response = await axios.post(
              `${this.cognitoUrl}/oauth2/token`,
              new URLSearchParams(configuration).toString(),
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
              }
            );

            if (response.status === 200 && response.data) {
              this.idToken = response.data.id_token;
              this.accessToken = response.data.access_token;
              this.tokenType = response.data.token_type;
              this.expiresIn = response.data.expires_in;

              if (
                response.data.refresh_token != null &&
                response.data.refresh_token !== ''
              ) {
                this.refreshToken = response.data.refresh_token;
              }

              try {
                if (
                  this.storeService &&
                  typeof this.storeService.set === 'function'
                ) {
                  this.storeService.set('auth.id_token', this.idToken);
                  this.storeService.set('auth.access_token', this.accessToken);
                  this.storeService.set('auth.token_type', this.tokenType);
                  this.storeService.set('auth.expires_in', this.expiresIn);
                  if (this.refreshToken)
                    this.storeService.set(
                      'auth.refresh_token',
                      this.refreshToken
                    );
                }

                this.setSessionTokensBundle({
                  'auth.id_token': this.idToken,
                  'auth.access_token': this.accessToken,
                  'auth.token_type': this.tokenType,
                  'auth.expires_in': String(this.expiresIn),
                  ...(this.refreshToken
                    ? { 'auth.refresh_token': this.refreshToken }
                    : {}),
                });
              } catch (e) {
                // ignore
              }

              return {
                idToken: this.idToken,
                accessToken: this.accessToken,
                tokenType: this.tokenType,
                expiresIn: this.expiresIn,
              };
            }

            throw new Error('No se pudo actualizar el token');
          } catch (error) {
            lastError = error;
            const recoverable = isRecoverableOAuthGrantError(error);
            const hasMoreAttempts = attempt < MAX_OAUTH_REFRESH_ATTEMPTS - 1;

            if (!recoverable || !hasMoreAttempts) {
              if (recoverable) {
                const userMsg = formatOAuthErrorForUser(error);
                try {
                  showOAuthRefreshFatalOverlay(userMsg);
                  if (typeof document !== 'undefined') {
                    document.dispatchEvent(
                      new CustomEvent('kaceOAuthRefreshFailed', {
                        detail: { message: userMsg, error },
                      })
                    );
                  }
                } catch (_) {
                  // ignore
                }
              }
              throw error;
            }
          }
        }

        throw lastError ?? new Error('No se pudo actualizar el token');
      } finally {
        this._refreshPromise = null;
      }
    })();

    return this._refreshPromise;
  }

  /**
   * Validate the current idToken, refresh if expired or about to expire
   * @returns {Promise<void>}
   */
  async validateToken() {
    this.hydrateTokensFromSessionStorage();
    if (this.isIdTokenValidLocal()) {
      return;
    }
    await this.refreshTokenFlow();
  }

  /**
   * Set tokens directly (for initial login or restore)
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string|null} params.refreshToken
   * @param {string} params.idToken
   * @param {string} params.tokenType
   * @param {number} params.expiresIn
   * @returns {void}
   */
  setTokens({ accessToken, refreshToken, idToken, tokenType, expiresIn }) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.idToken = idToken;
    this.tokenType = tokenType;
    this.expiresIn = expiresIn;

    try {
      this.setSessionTokensBundle({
        ...(idToken ? { 'auth.id_token': idToken } : {}),
        ...(accessToken ? { 'auth.access_token': accessToken } : {}),
        ...(tokenType ? { 'auth.token_type': tokenType } : {}),
        ...(expiresIn != null ? { 'auth.expires_in': String(expiresIn) } : {}),
        ...(refreshToken ? { 'auth.refresh_token': refreshToken } : {}),
      });
    } catch (_) {
      // ignore
    }
  }
}
