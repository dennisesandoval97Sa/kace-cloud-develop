import axios from "axios";
import { API } from "../../main";
import { jwtDecode } from "jwt-decode";
import { COGNITO_AUTHENTICATION, COGNITO_CLIENT_ID, COGNITO_REDIRECT_URI, COGNITO_URL, TENANT_ID } from "../../URL";
import { convertTimestamps } from "../utils/dateUtils";
import { hasMock, mockRequest } from "../utils/mockApiService";
import { hasLocal, getLocalUrl } from "../utils/localApiService";
import getClientFingerprint from "../../fingerprint";
import { validateError } from "./validationErrors";
import { extractAuthErrorCode } from "./authErrorCode.js";
import { readActiveAuthTokens } from "../../authPendingSession.js";
import {
    refreshTokensDeduped,
    isIdTokenValid,
    readTokensFromStorage,
    REFRESH_WHEN_REMAINING_MS,
} from "../../cognitoTokenRefreshCoordinator.js";
import {
    API_SESSION_AUTH_FAILED_EVENT,
    API_SESSION_CONFLICT_EVENT,
    AUTH_ERROR_SESSION_ACTIVE_ON_ANOTHER_DEVICE,
    AUTH_ERROR_SESSION_COOKIE_STALE,
    AUTH_ERROR_SESSION_KEY_MISMATCH,
    shouldEmitSessionConflictEvent,
} from "@/utils/apiAuthEvents";

const AUTH_COGNITO_PATH = "/auth-cognito";
const API_FORCE_LOGOUT_EVENT = "kace:api-force-logout";
let logoutEventDispatched = false;

function forceLogoutFromApiService() {
    if (logoutEventDispatched) {
        return;
    }
    logoutEventDispatched = true;
    window.dispatchEvent(new CustomEvent(API_FORCE_LOGOUT_EVENT));
}

function isRecoverableSessionError(authCode) {
    return authCode === AUTH_ERROR_SESSION_COOKIE_STALE || authCode === AUTH_ERROR_SESSION_KEY_MISMATCH;
}

const cognitoOAuthConfig = {
    cognitoUrl: COGNITO_URL,
    clientId: COGNITO_CLIENT_ID,
    redirectUri: COGNITO_REDIRECT_URI,
};

function getAuthorizationHeaderToken(tokens) {
    return tokens?.id_token ?? null;
}

async function refreshCognitoAccessTokenDeduped() {
    return refreshTokensDeduped(cognitoOAuthConfig);
}

/**
 * Returns a token set whose id_token is guaranteed non-expired, refreshing when needed.
 *
 * Use this before posting tokens in a request BODY to /auth-cognito: that endpoint verifies
 * the body id_token server-side (validateBodyTokenExpiration -> verifyJwt) and returns
 * 401 "Invalid token" if it is expired. The request interceptor only refreshes the
 * Authorization HEADER, not the body, so callers that send tokens in the body must ensure
 * validity themselves.
 *
 * Validity uses isIdTokenValid's ID_TOKEN_SAFETY_MARGIN_MS (60s) on purpose — wider than the
 * request interceptor's 10s threshold — so the posted body token keeps enough headroom to
 * survive the request round-trip and the backend's clock-skew compensation. The two margins
 * never cause a double refresh (60s > 10s): a token the interceptor would refresh (<10s) is
 * already invalid here and refreshed first.
 *
 * SIDE EFFECT: when a refresh happens, refreshTokensDeduped writes the new tokens to
 * local/session storage and broadcasts a tokens-updated message on the kace-token-sync
 * channel. Callers must not assume storage is unchanged after calling this.
 *
 * @returns {Promise<object>} resolves with a valid token set, or throws if no refresh is possible.
 */
export async function ensureValidAuthTokens() {
    const tokens = readTokensFromStorage();
    if (tokens?.id_token && isIdTokenValid(tokens.id_token)) {
        return tokens;
    }
    return refreshCognitoAccessTokenDeduped();
}

async function rebindSessionViaAuthCognito() {
    let tokens;
    try {
        tokens = await refreshCognitoAccessTokenDeduped();
    } catch {
        tokens = readTokensFromStorage();
    }

    if (!tokens?.id_token) {
        throw new Error("Missing tokens");
    }

    if (!isIdTokenValid(tokens.id_token)) {
        throw new Error("Missing valid tokens");
    }

    await api.post(COGNITO_AUTHENTICATION, tokens, { _isSessionRebindRequest: true });
    return tokens;
}

let sessionRebindPromise = null;

function rebindSessionViaAuthCognitoDeduped() {
    if (!sessionRebindPromise) {
        sessionRebindPromise = rebindSessionViaAuthCognito().finally(() => {
            sessionRebindPromise = null;
        });
    }
    return sessionRebindPromise;
}

const api = axios.create({
    baseURL: API.BASE_URL,
    timeout: 40000,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(
    async (config) => {
        config.headers["X-Client-Fingerprint"] = await getClientFingerprint();
        config.headers["X-Tenant-Id"] = TENANT_ID;
        config.withCredentials = true;

        const rawTokens = readActiveAuthTokens();
        const tokens = rawTokens ?? null;
        const token = tokens?.id_token;

        if (token) {
            const decoded = jwtDecode(token);
            const expiration_id_token_date = decoded.exp * 1000;
            const currentTime = Date.now();
            const timeLeft = expiration_id_token_date - currentTime;

            if (timeLeft <= REFRESH_WHEN_REMAINING_MS) {
                try {
                    const updated = await refreshCognitoAccessTokenDeduped();
                    config.headers.Authorization = `${getAuthorizationHeaderToken(updated)}`;
                } catch {
                    if (isIdTokenValid(token)) {
                        config.headers.Authorization = `${token}`;
                    }
                }
            } else {
                config.headers.Authorization = `${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

api.interceptors.response.use(
    (response) => {
        if (response.data) {
            response.data = convertTimestamps(response.data);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;
        const isAuthError = status === 401 || (axios.isAxiosError(error) && error.status === 401);
        const authCode = extractAuthErrorCode(error);

        const isSessionConflict = status === 409 && authCode === AUTH_ERROR_SESSION_ACTIVE_ON_ANOTHER_DEVICE;

        if (isSessionConflict && shouldEmitSessionConflictEvent()) {
            window.dispatchEvent(
                new CustomEvent(API_SESSION_CONFLICT_EVENT, {
                    detail: { originalRequest },
                }),
            );
            return Promise.reject(error);
        }

        if (isAuthError && originalRequest) {
            if (originalRequest._isSessionRebindRequest) {
                const customError = validateError(error);
                return Promise.reject(customError || error);
            }

            const isAuthEndpoint = String(originalRequest.url || "").includes(AUTH_COGNITO_PATH);

            if (!originalRequest._sessionRebindRetry && (isRecoverableSessionError(authCode) || isAuthEndpoint)) {
                originalRequest._sessionRebindRetry = true;
                try {
                    const tokens = await rebindSessionViaAuthCognitoDeduped();
                    originalRequest.headers.Authorization = `${tokens.id_token}`;
                    return api(originalRequest);
                } catch {
                    if (isAuthEndpoint) {
                        forceLogoutFromApiService();
                        return Promise.reject(error);
                    }
                }
            }

            if (!originalRequest._invalidTokenRetry) {
                originalRequest._invalidTokenRetry = true;
                try {
                    const newTokens = await refreshCognitoAccessTokenDeduped();
                    originalRequest.headers.Authorization = `${getAuthorizationHeaderToken(newTokens)}`;
                    return api(originalRequest);
                } catch (refreshErr) {
                    const storedTokens = readTokensFromStorage();
                    if (storedTokens?.id_token && isIdTokenValid(storedTokens.id_token)) {
                        originalRequest.headers.Authorization = `${storedTokens.id_token}`;
                        return api(originalRequest);
                    }
                    forceLogoutFromApiService();
                    return Promise.reject(refreshErr);
                }
            }

            window.dispatchEvent(
                new CustomEvent(API_SESSION_AUTH_FAILED_EVENT, {
                    detail: { code: authCode },
                }),
            );
        }

        const customError = validateError(error);
        if (customError) {
            return Promise.reject(customError);
        }
        return Promise.reject(error);
    },
);

const resolveRequest = (method, url, config, data = null) => {
    if (import.meta.env.VITE_ENABLE_MOCK_API && hasMock(url)) {
        return mockRequest(url, data);
    }

    if (import.meta.env.VITE_ENABLE_LOCAL_API && hasLocal(url)) {
        const localUrl = getLocalUrl(url);
        url = localUrl;
    }

    if (method === "get" || method === "delete") {
        return api[method](url, config);
    }

    return api[method](url, data, config);
};

export const apiService = {
    get: (url, config = {}) => resolveRequest("get", url, config),
    post: (url, data, config = {}) => resolveRequest("post", url, config, data),
    put: (url, data, config = {}) => resolveRequest("put", url, config, data),
    delete: (url, config = {}) => resolveRequest("delete", url, config),
};
