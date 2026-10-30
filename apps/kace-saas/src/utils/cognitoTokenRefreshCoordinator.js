import { readActiveAuthTokens, writeActiveAuthTokens } from "./authPendingSession.js";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

export const TOKENS_STORAGE_KEY = "tokens";
export const OAUTH_REFRESH_LOCK_KEY = "kace:oauth-refresh-lock";
export const TOKEN_SYNC_CHANNEL_NAME = "kace-token-sync";
export const TOKEN_SYNC_STORAGE_KEY = "kace:token-sync";
export const ID_TOKEN_SAFETY_MARGIN_MS = 60000;
export const REFRESH_WHEN_REMAINING_MS = 10000;
export const OAUTH_REFRESH_LOCK_TTL_MS = 15000;
export const WAIT_PEER_REFRESH_MS = 5000;

const tabId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `tab-${Date.now()}-${Math.random()}`;

let inTabRefreshPromise = null;

function normalizeOAuthErrorBody(data) {
    if (data == null) {
        return {};
    }
    if (typeof data === "string") {
        try {
            const parsed = JSON.parse(data);
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }
    return typeof data === "object" ? data : {};
}

function isAxiosLikeError(error) {
    return Boolean(error && typeof error === "object" && error.response && error.config);
}

export function isRecoverableOAuthGrantError(error) {
    if (!isAxiosLikeError(error)) {
        return false;
    }
    const status = error.response.status;
    if (status !== 400 && status !== 401) {
        return false;
    }
    const body = normalizeOAuthErrorBody(error.response.data);
    const code = String(body.error || "").toLowerCase();
    if (code === "invalid_grant" || code === "invalid_token") {
        return true;
    }
    const desc = String(body.error_description || "").toLowerCase();
    if (desc.includes("invalid_grant")) {
        return true;
    }
    if (
        desc.includes("refresh") &&
        (desc.includes("invalid") || desc.includes("expired") || desc.includes("revoked"))
    ) {
        return true;
    }
    return false;
}

export function isTerminalOAuthError(error) {
    if (!isAxiosLikeError(error)) {
        return false;
    }
    const body = normalizeOAuthErrorBody(error.response.data);
    const code = String(body.error || "").toLowerCase();
    return code === "unauthorized_client" || code === "invalid_client";
}

export function isIdTokenValid(token, marginMs = ID_TOKEN_SAFETY_MARGIN_MS) {
    if (!token) {
        return false;
    }
    try {
        const decoded = jwtDecode(token);
        if (!decoded?.exp) {
            return false;
        }
        return decoded.exp * 1000 - marginMs > Date.now();
    } catch {
        return false;
    }
}

export function readTokensFromStorage() {
    return readActiveAuthTokens();
}

export function writeTokensToStorage(tokens) {
    writeActiveAuthTokens(tokens);
}

function getChannel() {
    if (typeof BroadcastChannel === "undefined") {
        return null;
    }
    return new BroadcastChannel(TOKEN_SYNC_CHANNEL_NAME);
}

function broadcastTokensUpdated() {
    const payload = { type: "tokens-updated", ts: Date.now() };
    const channel = getChannel();
    if (channel) {
        try {
            channel.postMessage(payload);
        } finally {
            channel.close();
        }
    }
    try {
        localStorage.setItem(TOKEN_SYNC_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        return;
    }
}

function readLock() {
    try {
        const raw = localStorage.getItem(OAUTH_REFRESH_LOCK_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function tryAcquireLock() {
    const now = Date.now();
    const existing = readLock();
    if (existing && existing.expiresAt > now && existing.ownerTabId !== tabId) {
        return false;
    }
    localStorage.setItem(
        OAUTH_REFRESH_LOCK_KEY,
        JSON.stringify({
            ownerTabId: tabId,
            expiresAt: now + OAUTH_REFRESH_LOCK_TTL_MS,
        }),
    );
    return true;
}

function releaseLock() {
    const existing = readLock();
    if (existing?.ownerTabId === tabId) {
        localStorage.removeItem(OAUTH_REFRESH_LOCK_KEY);
    }
}

function waitForPeerRefresh(previousSnapshot) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + WAIT_PEER_REFRESH_MS;
        const channel = getChannel();

        const cleanup = () => {
            channel?.removeEventListener("message", onMessage);
            window.removeEventListener("storage", onStorage);
            channel?.close();
        };

        const tryResolve = () => {
            const tokens = readTokensFromStorage();
            if (tokens?.id_token && isIdTokenValid(tokens.id_token)) {
                const changed =
                    !previousSnapshot ||
                    tokens.id_token !== previousSnapshot.id_token ||
                    tokens.refresh_token !== previousSnapshot.refresh_token;
                const lock = readLock();
                const lockReleased = !lock || lock.expiresAt <= Date.now() || lock.ownerTabId === tabId;
                if (changed || lockReleased) {
                    cleanup();
                    resolve(tokens);
                    return true;
                }
            }
            return false;
        };

        const onMessage = () => {
            tryResolve();
        };

        const onStorage = (event) => {
            if (
                event.key === TOKENS_STORAGE_KEY ||
                event.key === TOKEN_SYNC_STORAGE_KEY ||
                event.key === OAUTH_REFRESH_LOCK_KEY
            ) {
                tryResolve();
            }
        };

        channel?.addEventListener("message", onMessage);
        window.addEventListener("storage", onStorage);

        const poll = () => {
            if (tryResolve()) {
                return;
            }
            if (Date.now() >= deadline) {
                const tokens = readTokensFromStorage();
                if (tokens?.id_token && isIdTokenValid(tokens.id_token)) {
                    cleanup();
                    resolve(tokens);
                    return;
                }
                cleanup();
                reject(new Error("Timed out waiting for peer refresh"));
                return;
            }
            setTimeout(poll, 50);
        };

        poll();
    });
}

async function performOAuthRefresh(config) {
    const tokens = readTokensFromStorage();
    if (!tokens?.refresh_token) {
        throw new Error("Missing refresh token");
    }

    const configuration = {
        grant_type: "refresh_token",
        client_id: config.clientId,
        refresh_token: tokens.refresh_token,
        redirect_uri: config.redirectUri,
    };

    try {
        const response = await axios.post(
            `${config.cognitoUrl}/oauth2/token`,
            new URLSearchParams(configuration).toString(),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            },
        );
        const next = {
            ...tokens,
            ...response.data,
            refresh_token: response.data.refresh_token ?? tokens.refresh_token,
        };
        writeTokensToStorage(next);
        broadcastTokensUpdated();
        return next;
    } catch (error) {
        if (isRecoverableOAuthGrantError(error) && isIdTokenValid(tokens.id_token)) {
            return tokens;
        }
        throw error;
    }
}

async function refreshWithLock(config) {
    const snapshot = readTokensFromStorage();
    if (!tryAcquireLock()) {
        return waitForPeerRefresh(snapshot);
    }
    try {
        return await performOAuthRefresh(config);
    } finally {
        releaseLock();
    }
}

export async function refreshTokensDeduped(config) {
    if (inTabRefreshPromise) {
        return inTabRefreshPromise;
    }
    inTabRefreshPromise = refreshWithLock(config).finally(() => {
        inTabRefreshPromise = null;
    });
    return inTabRefreshPromise;
}
