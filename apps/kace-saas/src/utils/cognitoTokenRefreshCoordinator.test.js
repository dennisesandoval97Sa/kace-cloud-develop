import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("axios", () => ({
    default: {
        post: vi.fn(),
    },
}));

class MockBroadcastChannel {
    static instances = [];
    constructor(name) {
        this.name = name;
        this.listeners = new Set();
        this.closed = false;
        MockBroadcastChannel.instances.push(this);
    }
    postMessage(data) {
        const event = { data };
        for (const inst of MockBroadcastChannel.instances) {
            if (inst === this || inst.closed || inst.name !== this.name) continue;
            for (const fn of inst.listeners) fn(event);
        }
    }
    addEventListener(_type, fn) {
        this.listeners.add(fn);
    }
    removeEventListener(_type, fn) {
        this.listeners.delete(fn);
    }
    close() {
        this.closed = true;
    }
}

function createTestJwt(expOffsetSeconds = 3600) {
    const payload = { exp: Math.floor(Date.now() / 1000) + expOffsetSeconds, sub: "user" };
    const base64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}.sig`;
}

beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    MockBroadcastChannel.instances = [];
    globalThis.BroadcastChannel = MockBroadcastChannel;
});

afterEach(() => {
    delete globalThis.BroadcastChannel;
    vi.restoreAllMocks();
});

describe("isRecoverableOAuthGrantError", () => {
    it("returns true for 400 invalid_grant", async () => {
        const { isRecoverableOAuthGrantError } = await import("./cognitoTokenRefreshCoordinator.js");
        const error = {
            config: {},
            response: { status: 400, data: { error: "invalid_grant" } },
        };
        expect(isRecoverableOAuthGrantError(error)).toBe(true);
    });

    it("returns true for 401 invalid_token", async () => {
        const { isRecoverableOAuthGrantError } = await import("./cognitoTokenRefreshCoordinator.js");
        const error = {
            config: {},
            response: { status: 401, data: { error: "invalid_token" } },
        };
        expect(isRecoverableOAuthGrantError(error)).toBe(true);
    });

    it("returns false for unauthorized_client", async () => {
        const { isRecoverableOAuthGrantError } = await import("./cognitoTokenRefreshCoordinator.js");
        const error = {
            config: {},
            response: { status: 400, data: { error: "unauthorized_client" } },
        };
        expect(isRecoverableOAuthGrantError(error)).toBe(false);
    });
});

describe("isIdTokenValid", () => {
    it("returns true when id_token expires beyond safety margin", async () => {
        const { isIdTokenValid } = await import("./cognitoTokenRefreshCoordinator.js");
        const token = createTestJwt(3600);
        expect(isIdTokenValid(token)).toBe(true);
    });

    it("returns false when id_token is expired", async () => {
        const { isIdTokenValid } = await import("./cognitoTokenRefreshCoordinator.js");
        const token = createTestJwt(-120);
        expect(isIdTokenValid(token)).toBe(false);
    });

    it("returns false for null token", async () => {
        const { isIdTokenValid } = await import("./cognitoTokenRefreshCoordinator.js");
        expect(isIdTokenValid(null)).toBe(false);
    });
});

describe("readTokensFromStorage and writeTokensToStorage", () => {
    it("round-trips tokens in localStorage", async () => {
        const { readTokensFromStorage, writeTokensToStorage } = await import("./cognitoTokenRefreshCoordinator.js");
        const tokens = { id_token: "a", refresh_token: "b" };
        writeTokensToStorage(tokens);
        expect(readTokensFromStorage()).toEqual(tokens);
    });
});

describe("refreshTokensDeduped", () => {
    const cognitoConfig = {
        cognitoUrl: "https://devkace.auth.us-east-1.amazoncognito.com",
        clientId: "client-id",
        redirectUri: "https://app.example/callback",
    };

    it("stores rotated refresh_token from Cognito response", async () => {
        const axios = (await import("axios")).default;
        const validJwt = createTestJwt(3600);
        localStorage.setItem("tokens", JSON.stringify({ refresh_token: "old-refresh", id_token: validJwt }));

        axios.post.mockResolvedValueOnce({
            data: {
                id_token: "new-id-token",
                access_token: "new-access",
                refresh_token: "new-refresh",
            },
        });

        const { refreshTokensDeduped, readTokensFromStorage } = await import("./cognitoTokenRefreshCoordinator.js");
        await refreshTokensDeduped(cognitoConfig);

        const stored = readTokensFromStorage();
        expect(stored.refresh_token).toBe("new-refresh");
        expect(stored.id_token).toBe("new-id-token");
    });

    it("returns current tokens when Cognito responds invalid_grant but id_token is still valid", async () => {
        const axios = (await import("axios")).default;
        const validJwt = createTestJwt(3600);
        const tokens = { refresh_token: "stale-refresh", id_token: validJwt, access_token: "access" };
        localStorage.setItem("tokens", JSON.stringify(tokens));

        axios.post.mockRejectedValueOnce({
            config: {},
            response: { status: 400, data: { error: "invalid_grant" } },
        });

        const { refreshTokensDeduped, readTokensFromStorage } = await import("./cognitoTokenRefreshCoordinator.js");
        const result = await refreshTokensDeduped(cognitoConfig);

        expect(result.id_token).toBe(validJwt);
        expect(readTokensFromStorage().id_token).toBe(validJwt);
    });

    it("deduplicates concurrent refresh calls in the same tab", async () => {
        const axios = (await import("axios")).default;
        const validJwt = createTestJwt(3600);
        localStorage.setItem("tokens", JSON.stringify({ refresh_token: "refresh", id_token: validJwt }));

        let resolvePost;
        axios.post.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolvePost = resolve;
                }),
        );

        const { refreshTokensDeduped } = await import("./cognitoTokenRefreshCoordinator.js");
        const first = refreshTokensDeduped(cognitoConfig);
        const second = refreshTokensDeduped(cognitoConfig);

        resolvePost({
            data: { id_token: "deduped-id", access_token: "deduped-access" },
        });

        const [a, b] = await Promise.all([first, second]);
        expect(a.id_token).toBe("deduped-id");
        expect(b.id_token).toBe("deduped-id");
        expect(axios.post).toHaveBeenCalledTimes(1);
    });
});
