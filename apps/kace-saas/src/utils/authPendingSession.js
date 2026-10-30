export const PENDING_AUTH_TOKENS_KEY = "kace:pending-auth-tokens";
export const SESSION_REJECTED_STORAGE_KEY = "kace:session-rejected";

export function readActiveAuthTokens() {
    const pendingRaw = sessionStorage.getItem(PENDING_AUTH_TOKENS_KEY);
    if (pendingRaw) {
        try {
            return JSON.parse(pendingRaw);
        } catch {
            return null;
        }
    }

    try {
        const raw = localStorage.getItem("tokens");
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function stagePendingAuthTokens(tokens) {
    sessionStorage.setItem(PENDING_AUTH_TOKENS_KEY, JSON.stringify(tokens));
}

export function clearPendingAuthTokens() {
    sessionStorage.removeItem(PENDING_AUTH_TOKENS_KEY);
}

export function commitAuthTokensToLocalStorage(tokens) {
    localStorage.setItem("tokens", JSON.stringify(tokens));
    clearPendingAuthTokens();
}

export function rejectPendingAuthSession() {
    clearPendingAuthTokens();
    sessionStorage.setItem(SESSION_REJECTED_STORAGE_KEY, "1");
}

export function hasPendingAuthTokens() {
    return sessionStorage.getItem(PENDING_AUTH_TOKENS_KEY) != null;
}

export function writeActiveAuthTokens(tokens) {
    if (hasPendingAuthTokens()) {
        stagePendingAuthTokens(tokens);
        return;
    }
    localStorage.setItem("tokens", JSON.stringify(tokens));
}
