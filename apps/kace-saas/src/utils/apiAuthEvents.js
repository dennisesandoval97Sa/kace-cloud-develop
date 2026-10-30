import { PUBLIC_ERROR_CODES } from "@kace/error-codes";

export const API_SESSION_AUTH_FAILED_EVENT = "kace:api-session-auth-failed";
export const API_SESSION_CONFLICT_EVENT = "kace:api-session-conflict";

export const AUTH_ERROR_SESSION_KEY_MISMATCH = PUBLIC_ERROR_CODES.AUTH_SESSION_KEY_MISMATCH;
export const AUTH_ERROR_SESSION_COOKIE_STALE = PUBLIC_ERROR_CODES.AUTH_SESSION_COOKIE_STALE;
export const AUTH_ERROR_SESSION_ACTIVE_ON_ANOTHER_DEVICE = PUBLIC_ERROR_CODES.AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE;

let sessionConflictEventsSuppressed = false;

export function suppressSessionConflictEvents() {
    sessionConflictEventsSuppressed = true;
}

export function resetSessionConflictEventSuppression() {
    sessionConflictEventsSuppressed = false;
}

export function shouldEmitSessionConflictEvent() {
    return !sessionConflictEventsSuppressed;
}
