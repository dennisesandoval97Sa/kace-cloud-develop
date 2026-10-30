import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { API_SESSION_CONFLICT_EVENT, AUTH_ERROR_SESSION_ACTIVE_ON_ANOTHER_DEVICE } from "../../apiAuthEvents";

const mockAxiosInstance = Object.assign(vi.fn(), {
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    },
    request: vi.fn(),
});

const API_SESSION_CONFLICT_EVENT = "kace:api-session-conflict";
const AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE = "0x070007";
const LEGACY_AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE = "0x0707";

vi.mock("axios", () => ({
    default: {
        create: vi.fn(() => mockAxiosInstance),
        post: vi.fn(),
        isAxiosError: (error) => Boolean(error?.isAxiosError),
    },
}));

vi.mock("../../fingerprint", () => ({
    default: vi.fn().mockResolvedValue("fp-test"),
}));

vi.mock("../../URL", () => ({
    API: { BASE_URL: "https://api.test" },
    COGNITO_AUTHENTICATION: "/auth-cognito",
    COGNITO_CLIENT_ID: "client-id",
    COGNITO_REDIRECT_URI: "https://app.test/callback",
    COGNITO_URL: "https://cognito.test",
    TENANT_ID: "tenant-1",
}));

vi.mock("../utils/dateUtils", () => ({
    convertTimestamps: (data) => data,
}));

vi.mock("../utils/mockApiService", () => ({
    hasMock: () => false,
    mockRequest: vi.fn(),
}));

vi.mock("../../cognitoTokenRefreshCoordinator.js", async () => {
    const actual = await vi.importActual("../../cognitoTokenRefreshCoordinator.js");
    return {
        ...actual,
        refreshTokensDeduped: vi.fn(),
    };
});

vi.mock("./validationErrors", () => ({
    validateError: () => null,
}));

function createTestJwt(expOffsetSeconds = 3600) {
    const payload = { exp: Math.floor(Date.now() / 1000) + expOffsetSeconds, sub: "user" };
    const base64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}.sig`;
}

describe("apiService oauth recovery", () => {
    let responseErrorHandler;
    let refreshTokensDeduped;
    let isIdTokenValid;
    let ensureValidAuthTokens;

    async function expectSessionConflictEventForCode(code) {
        const originalRequest = { url: "/cases", headers: {} };
        const conflictListener = vi.fn();
        window.addEventListener(API_SESSION_CONFLICT_EVENT, conflictListener);

        const error = {
            config: originalRequest,
            response: { status: 409, data: { data: { code } } },
            isAxiosError: true,
        };

        try {
            await expect(responseErrorHandler(error)).rejects.toBe(error);
            expect(conflictListener).toHaveBeenCalledTimes(1);
            expect(conflictListener.mock.calls[0][0].detail.originalRequest).toBe(originalRequest);
            expect(mockAxiosInstance).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener(API_SESSION_CONFLICT_EVENT, conflictListener);
        }
    }

    async function expectSessionConflictEventForCode(code) {
        const originalRequest = { url: "/cases", headers: {} };
        const conflictListener = vi.fn();
        window.addEventListener(API_SESSION_CONFLICT_EVENT, conflictListener);

        const error = {
            config: originalRequest,
            response: { status: 409, data: { data: { code } } },
            isAxiosError: true,
        };

        try {
            await expect(responseErrorHandler(error)).rejects.toBe(error);
            expect(conflictListener).toHaveBeenCalledTimes(1);
            expect(conflictListener.mock.calls[0][0].detail.originalRequest).toBe(originalRequest);
            expect(mockAxiosInstance).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener(API_SESSION_CONFLICT_EVENT, conflictListener);
        }
    }

    beforeEach(async () => {
        localStorage.clear();
        vi.resetModules();
        mockAxiosInstance.mockReset();
        mockAxiosInstance.mockResolvedValue({ data: { ok: true }, config: {} });
        mockAxiosInstance.interceptors.request.use.mockClear();
        mockAxiosInstance.interceptors.response.use.mockClear();

        const coordinator = await import("../../cognitoTokenRefreshCoordinator.js");
        refreshTokensDeduped = coordinator.refreshTokensDeduped;
        isIdTokenValid = coordinator.isIdTokenValid;
        refreshTokensDeduped.mockReset();

        const apiModule = await import("./apiService.js");
        ensureValidAuthTokens = apiModule.ensureValidAuthTokens;

        const responseUseCalls = mockAxiosInstance.interceptors.response.use.mock.calls;
        responseErrorHandler = responseUseCalls[responseUseCalls.length - 1][1];
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("does not force logout when refresh returns invalid_grant but id_token is still valid", async () => {
        const validJwt = createTestJwt(3600);
        const tokens = { id_token: validJwt, refresh_token: "refresh", access_token: "access" };
        localStorage.setItem("tokens", JSON.stringify(tokens));
        refreshTokensDeduped.mockResolvedValue(tokens);

        const forceLogout = vi.fn();
        window.addEventListener("kace:api-force-logout", forceLogout);

        const error = {
            config: { url: "/cases", headers: {}, _invalidTokenRetry: false },
            response: { status: 401, data: { message: "Unauthorized" } },
            isAxiosError: true,
            status: 401,
        };

        const result = await responseErrorHandler(error);

        expect(forceLogout).not.toHaveBeenCalled();
        expect(result.data.ok).toBe(true);
        expect(mockAxiosInstance).toHaveBeenCalled();
        window.removeEventListener("kace:api-force-logout", forceLogout);
    });

    it("forces logout when refresh fails and id_token is expired", async () => {
        const expiredJwt = createTestJwt(-120);
        localStorage.setItem(
            "tokens",
            JSON.stringify({ id_token: expiredJwt, refresh_token: "refresh", access_token: "access" }),
        );
        refreshTokensDeduped.mockRejectedValue({
            config: {},
            response: { status: 400, data: { error: "invalid_grant" } },
        });

        const forceLogout = vi.fn();
        window.addEventListener("kace:api-force-logout", forceLogout);

        const error = {
            config: { url: "/cases", headers: {}, _invalidTokenRetry: false },
            response: { status: 401, data: { message: "Unauthorized" } },
            isAxiosError: true,
            status: 401,
        };

        await expect(responseErrorHandler(error)).rejects.toBeDefined();
        expect(refreshTokensDeduped).toHaveBeenCalled();
        expect(isIdTokenValid(expiredJwt)).toBe(false);
        expect(forceLogout).toHaveBeenCalledTimes(1);
        window.removeEventListener("kace:api-force-logout", forceLogout);
    });

    it("emits the session conflict event for fixed-width public conflict codes", async () => {
        await expectSessionConflictEventForCode(AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE);
    });

    it("emits the session conflict event for legacy short conflict codes during rollout", async () => {
        await expectSessionConflictEventForCode(LEGACY_AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE);
    });

    it("does not re-enter the rebind loop when the internal /auth-cognito rebind POST fails with 401", async () => {
        const validJwt = createTestJwt(3600);
        const tokens = { id_token: validJwt, refresh_token: "refresh", access_token: "access" };
        localStorage.setItem("tokens", JSON.stringify(tokens));

        const forceLogout = vi.fn();
        window.addEventListener("kace:api-force-logout", forceLogout);

        const error = {
            config: { url: "/auth-cognito", headers: {}, _isSessionRebindRequest: true },
            response: { status: 401, data: { message: "Unauthorized" } },
            isAxiosError: true,
            status: 401,
        };

        await expect(responseErrorHandler(error)).rejects.toBe(error);
        expect(refreshTokensDeduped).not.toHaveBeenCalled();
        expect(mockAxiosInstance).not.toHaveBeenCalled();
        expect(forceLogout).not.toHaveBeenCalled();
        window.removeEventListener("kace:api-force-logout", forceLogout);
    });

    it("ensureValidAuthTokens returns stored tokens without refreshing when id_token is valid", async () => {
        const validJwt = createTestJwt(3600);
        const tokens = { id_token: validJwt, refresh_token: "refresh", access_token: "access" };
        localStorage.setItem("tokens", JSON.stringify(tokens));
        refreshTokensDeduped.mockResolvedValue({ id_token: "SHOULD_NOT_BE_USED" });

        const result = await ensureValidAuthTokens();

        expect(result.id_token).toBe(validJwt);
        expect(refreshTokensDeduped).not.toHaveBeenCalled();
    });

    it("ensureValidAuthTokens refreshes when the stored id_token is expired (avoids posting it to /auth-cognito)", async () => {
        const expiredJwt = createTestJwt(-120);
        const freshJwt = createTestJwt(3600);
        localStorage.setItem(
            "tokens",
            JSON.stringify({ id_token: expiredJwt, refresh_token: "refresh", access_token: "access" }),
        );
        const refreshed = { id_token: freshJwt, refresh_token: "refresh2", access_token: "access2" };
        refreshTokensDeduped.mockResolvedValue(refreshed);

        const result = await ensureValidAuthTokens();

        expect(refreshTokensDeduped).toHaveBeenCalledTimes(1);
        expect(result.id_token).toBe(freshJwt);
        expect(isIdTokenValid(result.id_token)).toBe(true);
    });

    it("ensureValidAuthTokens refreshes when there are no tokens in storage", async () => {
        const freshJwt = createTestJwt(3600);
        const refreshed = { id_token: freshJwt, refresh_token: "refresh2", access_token: "access2" };
        refreshTokensDeduped.mockResolvedValue(refreshed);

        const result = await ensureValidAuthTokens();

        expect(refreshTokensDeduped).toHaveBeenCalledTimes(1);
        expect(result.id_token).toBe(freshJwt);
    });

    it("ensureValidAuthTokens propagates the refresh error when storage is empty", async () => {
        refreshTokensDeduped.mockRejectedValue(new Error("Missing refresh token"));

        await expect(ensureValidAuthTokens()).rejects.toThrow("Missing refresh token");
    });

    it("emits the session conflict event for the active-session conflict code", async () => {
        await expectSessionConflictEventForCode(AUTH_ERROR_SESSION_ACTIVE_ON_ANOTHER_DEVICE);
    });
});
