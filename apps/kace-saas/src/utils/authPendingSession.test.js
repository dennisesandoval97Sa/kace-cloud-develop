import { describe, it, expect, beforeEach } from "vitest";
import {
    PENDING_AUTH_TOKENS_KEY,
    SESSION_REJECTED_STORAGE_KEY,
    readActiveAuthTokens,
    stagePendingAuthTokens,
    commitAuthTokensToLocalStorage,
    rejectPendingAuthSession,
    hasPendingAuthTokens,
    writeActiveAuthTokens,
} from "./authPendingSession.js";

describe("authPendingSession", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("reads committed tokens from localStorage when no pending session exists", () => {
        localStorage.setItem("tokens", JSON.stringify({ id_token: "committed" }));
        expect(readActiveAuthTokens()).toEqual({ id_token: "committed" });
    });

    it("prefers pending tokens over localStorage during login attempt", () => {
        localStorage.setItem("tokens", JSON.stringify({ id_token: "committed" }));
        stagePendingAuthTokens({ id_token: "pending" });
        expect(readActiveAuthTokens()).toEqual({ id_token: "pending" });
    });

    it("commitAuthTokensToLocalStorage promotes pending tokens and clears pending storage", () => {
        stagePendingAuthTokens({ id_token: "pending" });
        commitAuthTokensToLocalStorage({ id_token: "pending" });
        expect(localStorage.getItem("tokens")).toBe(JSON.stringify({ id_token: "pending" }));
        expect(sessionStorage.getItem(PENDING_AUTH_TOKENS_KEY)).toBeNull();
    });

    it("rejectPendingAuthSession clears pending tokens without touching localStorage", () => {
        localStorage.setItem("tokens", JSON.stringify({ id_token: "committed" }));
        stagePendingAuthTokens({ id_token: "pending" });
        rejectPendingAuthSession();
        expect(localStorage.getItem("tokens")).toBe(JSON.stringify({ id_token: "committed" }));
        expect(hasPendingAuthTokens()).toBe(false);
        expect(sessionStorage.getItem(SESSION_REJECTED_STORAGE_KEY)).toBe("1");
    });

    it("writeActiveAuthTokens updates pending storage without touching committed localStorage tokens", () => {
        localStorage.setItem("tokens", JSON.stringify({ id_token: "committed" }));
        stagePendingAuthTokens({ id_token: "pending" });
        writeActiveAuthTokens({ id_token: "pending-refreshed" });
        expect(localStorage.getItem("tokens")).toBe(JSON.stringify({ id_token: "committed" }));
        expect(readActiveAuthTokens()).toEqual({ id_token: "pending-refreshed" });
    });
});
