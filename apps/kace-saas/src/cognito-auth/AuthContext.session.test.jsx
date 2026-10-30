import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./AuthContext";
import {
    API_SESSION_AUTH_FAILED_EVENT,
    API_SESSION_CONFLICT_EVENT,
    AUTH_ERROR_SESSION_ACTIVE_ON_ANOTHER_DEVICE,
    AUTH_ERROR_SESSION_KEY_MISMATCH,
    AUTH_ERROR_SESSION_COOKIE_STALE,
    resetSessionConflictEventSuppression,
} from "@/utils/apiAuthEvents";
import { fetchUserData } from "../services/userService";
import { PENDING_AUTH_TOKENS_KEY, stagePendingAuthTokens } from "@/utils/authPendingSession";

vi.mock("../services/cognitoService", () => ({
    getCognitoCredentials: vi.fn().mockResolvedValue(null),
    handlerLogout: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/userService", () => ({
    fetchUserData: vi.fn().mockResolvedValue({ user: { id: "user-1" }, groups: [] }),
    mapAuthCognitoResponse: vi.fn((response) => response.data.data),
}));
vi.mock("@/hooks/useUserInformation", () => ({
    default: () => ({ user: { id: "test-id" } }),
}));
vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ processSchemaFields: vi.fn() }),
}));
vi.mock("@/hooks/useFingerprint", () => ({
    default: () => ({ fingerprint: "fp-test", isLoading: false }),
}));

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }) => (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
    );
};

describe("AuthContext - session conflict and taken-over states", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("tokens", JSON.stringify({ id_token: "tok" }));
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        resetSessionConflictEventSuppression();
    });

    it("T14: sets isSessionConflict=true when API_SESSION_CONFLICT_EVENT is dispatched", async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

        await act(async () => {
            window.dispatchEvent(
                new CustomEvent(API_SESSION_CONFLICT_EVENT, {
                    detail: { originalRequest: { data: "{}", url: "/auth-cognito", method: "post" } },
                }),
            );
        });

        expect(result.current.isSessionConflict).toBe(true);
        expect(result.current.hasErrorAuth).toBe(false);
    });

    it("T17: sets isSessionTakenOver=true when AUTH_SESSION_KEY_MISMATCH code received", async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

        await act(async () => {
            window.dispatchEvent(
                new CustomEvent(API_SESSION_AUTH_FAILED_EVENT, {
                    detail: { code: AUTH_ERROR_SESSION_KEY_MISMATCH },
                }),
            );
        });

        expect(result.current.isSessionTakenOver).toBe(true);
        expect(result.current.hasErrorAuth).toBe(false);
    });

    it("T18: sets hasErrorAuth=true for non-session-key auth failures", async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

        await act(async () => {
            window.dispatchEvent(
                new CustomEvent(API_SESSION_AUTH_FAILED_EVENT, {
                    detail: { code: "0x070002" },
                }),
            );
        });

        expect(result.current.hasErrorAuth).toBe(true);
        expect(result.current.isSessionTakenOver).toBe(false);
    });

    it("T21: does not set isSessionTakenOver when AUTH_SESSION_COOKIE_STALE code received", async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

        await act(async () => {
            window.dispatchEvent(
                new CustomEvent(API_SESSION_AUTH_FAILED_EVENT, {
                    detail: { code: AUTH_ERROR_SESSION_COOKIE_STALE },
                }),
            );
        });

        expect(result.current.isSessionTakenOver).toBe(false);
        expect(result.current.hasErrorAuth).toBe(false);
    });

    it("T19: onRejectTakeover clears pending session and shows rejected state without touching committed tokens", async () => {
        localStorage.setItem("tokens", JSON.stringify({ id_token: "committed" }));
        localStorage.setItem("userGroupId", "group-active");
        stagePendingAuthTokens({ id_token: "pending" });
        vi.mocked(fetchUserData).mockRejectedValueOnce({
            response: { status: 409, data: { data: { code: AUTH_ERROR_SESSION_ACTIVE_ON_ANOTHER_DEVICE } } },
        });
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

        await act(async () => {
            window.dispatchEvent(
                new CustomEvent(API_SESSION_CONFLICT_EVENT, {
                    detail: { originalRequest: { data: "{}", url: "/auth-cognito", method: "post" } },
                }),
            );
        });

        expect(result.current.isSessionConflict).toBe(true);

        await act(async () => {
            result.current.onRejectTakeover();
        });

        expect(result.current.isSessionConflict).toBe(false);
        expect(result.current.isSessionRejected).toBe(true);
        expect(localStorage.getItem("tokens")).toBe(JSON.stringify({ id_token: "committed" }));
        expect(localStorage.getItem("userGroupId")).toBe("group-active");
        expect(sessionStorage.getItem(PENDING_AUTH_TOKENS_KEY)).toBeNull();
        expect(sessionStorage.getItem("kace:session-rejected")).toBe("1");
    });

    it("T22: onRejectTakeover does not clear committed userGroupId or tokens in localStorage", async () => {
        localStorage.setItem("tokens", JSON.stringify({ id_token: "committed" }));
        localStorage.setItem("userGroupId", "group-active");
        stagePendingAuthTokens({ id_token: "pending" });
        vi.mocked(fetchUserData).mockRejectedValueOnce({
            response: { status: 409, data: { data: { code: AUTH_ERROR_SESSION_ACTIVE_ON_ANOTHER_DEVICE } } },
        });
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

        await act(async () => {
            window.dispatchEvent(
                new CustomEvent(API_SESSION_CONFLICT_EVENT, {
                    detail: { originalRequest: { data: "{}", url: "/auth-cognito", method: "post" } },
                }),
            );
        });

        await act(async () => {
            await result.current.onRejectTakeover();
        });

        expect(localStorage.getItem("userGroupId")).toBe("group-active");
        expect(localStorage.getItem("tokens")).toBe(JSON.stringify({ id_token: "committed" }));
    });

    it("T20: keeps conflict dismissed after reject when a late 409 event arrives", async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

        await act(async () => {
            window.dispatchEvent(
                new CustomEvent(API_SESSION_CONFLICT_EVENT, {
                    detail: { originalRequest: { data: "{}", url: "/auth-cognito", method: "post" } },
                }),
            );
        });

        await act(async () => {
            await result.current.onRejectTakeover();
        });

        await act(async () => {
            window.dispatchEvent(
                new CustomEvent(API_SESSION_CONFLICT_EVENT, {
                    detail: { originalRequest: { data: "{}", url: "/auth-cognito", method: "post" } },
                }),
            );
        });

        expect(result.current.isSessionConflict).toBe(false);
        expect(result.current.isSessionRejected).toBe(true);
    });
});
