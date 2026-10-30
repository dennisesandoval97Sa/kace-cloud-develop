import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import useUserInformation from "@/hooks/useUserInformation";
import { ensureValidAuthTokens } from "@/utils/src/services/apiService.js";
import { useOneScriptIframeHandshake } from "./useOneScriptIframeHandshake.js";

vi.mock("@/hooks/useUserInformation", () => ({
    default: vi.fn(),
}));

vi.mock("@/utils/src/services/apiService.js", () => ({
    ensureValidAuthTokens: vi.fn(),
}));

const IFRAME_ORIGIN = "https://onescript.example.com";
const IFRAME_SRC = `${IFRAME_ORIGIN}/form/abc`;

function makeIframeRef() {
    const contentWindow = { postMessage: vi.fn() };
    return { current: { src: IFRAME_SRC, contentWindow } };
}

const CONFIG = {
    enabled: true,
    params: {
        refresh_token: "rt",
        fingerprint: "fp",
        tenant_id: "t1",
        client_id: "c1",
        user_id: "u1",
        case_id: null,
        parent_id: null,
        cognito_client_id: "cog",
        cognito_url: "https://cognito.example.com",
        url_api: "https://api.example.com",
        one_script_form_id: "form1",
        grupo_activo: "g1",
    },
    tokens: { id_token: "id", access_token: "acc", token_type: "Bearer", expires_in: 3600 },
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserInformation).mockReturnValue({ userCache: { cache_ttl: 1740000 } });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("useOneScriptIframeHandshake", () => {
    it("does nothing when enabled is false", () => {
        const iframeRef = makeIframeRef();
        renderHook(() => useOneScriptIframeHandshake(iframeRef, { ...CONFIG, enabled: false }));

        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "KACE_INIT_REQUEST", requestId: "req-1" },
                }),
            );
        });

        expect(iframeRef.current.contentWindow.postMessage).not.toHaveBeenCalled();
    });

    it("responds with KACE_INIT_RESPONSE to a valid KACE_INIT_REQUEST", async () => {
        const iframeRef = makeIframeRef();
        renderHook(() => useOneScriptIframeHandshake(iframeRef, CONFIG));

        await act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "KACE_INIT_REQUEST", requestId: "req-123" },
                    source: iframeRef.current.contentWindow,
                }),
            );
        });

        await waitFor(() => expect(iframeRef.current.contentWindow.postMessage).toHaveBeenCalled());

        const [payload, targetOrigin] = iframeRef.current.contentWindow.postMessage.mock.calls[0];

        expect(payload.type).toBe("KACE_INIT_RESPONSE");
        expect(payload.requestId).toBe("req-123");
        expect(payload.params.tenant_id).toBe("t1");
        expect(payload.tokens.id_token).toBe("id");
        expect(targetOrigin).toBe(IFRAME_ORIGIN);
    });

    it("includes authCognitoResponse from userCache in the response", async () => {
        vi.mocked(useUserInformation).mockReturnValue({ userCache: { group_id: "g1" } });

        const iframeRef = makeIframeRef();
        renderHook(() => useOneScriptIframeHandshake(iframeRef, CONFIG));

        await act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "KACE_INIT_REQUEST", requestId: "req-456" },
                    source: iframeRef.current.contentWindow,
                }),
            );
        });

        await waitFor(() => expect(iframeRef.current.contentWindow.postMessage).toHaveBeenCalled());

        const [payload] = iframeRef.current.contentWindow.postMessage.mock.calls[0];
        expect(payload.authCognitoResponse).toEqual({ group_id: "g1" });
    });

    it("sends authCognitoResponse as undefined when userCache is absent", async () => {
        vi.mocked(useUserInformation).mockReturnValue({ userCache: undefined });

        const iframeRef = makeIframeRef();
        renderHook(() => useOneScriptIframeHandshake(iframeRef, CONFIG));

        await act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "KACE_INIT_REQUEST", requestId: "req-789" },
                    source: iframeRef.current.contentWindow,
                }),
            );
        });

        await waitFor(() => expect(iframeRef.current.contentWindow.postMessage).toHaveBeenCalled());

        const [payload] = iframeRef.current.contentWindow.postMessage.mock.calls[0];
        expect(payload.authCognitoResponse).toBeUndefined();
    });

    it("ignores messages that are not KACE_INIT_REQUEST", async () => {
        const iframeRef = makeIframeRef();
        renderHook(() => useOneScriptIframeHandshake(iframeRef, CONFIG));

        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "SOMETHING_ELSE", requestId: "req-1" },
                }),
            );
        });

        expect(iframeRef.current.contentWindow.postMessage).not.toHaveBeenCalled();
    });

    it("responds to KACE_REINIT_REQUEST with fresh tokens", async () => {
        const freshTokens = {
            id_token: "id-fresh",
            access_token: "acc-fresh",
            token_type: "Bearer",
            expires_in: 7200,
            refresh_token: "rt-fresh",
        };
        vi.mocked(ensureValidAuthTokens).mockResolvedValue(freshTokens);

        const iframeRef = makeIframeRef();
        renderHook(() => useOneScriptIframeHandshake(iframeRef, CONFIG));

        await act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "KACE_REINIT_REQUEST", requestId: "reinit-1" },
                    source: iframeRef.current.contentWindow,
                }),
            );
        });

        await waitFor(() => expect(iframeRef.current.contentWindow.postMessage).toHaveBeenCalled());

        const [payload, targetOrigin] = iframeRef.current.contentWindow.postMessage.mock.calls[0];

        expect(ensureValidAuthTokens).toHaveBeenCalledTimes(1);
        expect(payload.type).toBe("KACE_REINIT_RESPONSE");
        expect(payload.requestId).toBe("reinit-1");
        expect(payload.params.refresh_token).toBe("rt-fresh");
        expect(payload.params.tenant_id).toBe("t1");
        expect(payload.tokens).toEqual({
            id_token: "id-fresh",
            access_token: "acc-fresh",
            token_type: "Bearer",
            expires_in: 7200,
        });
        expect(payload.authCognitoResponse).toEqual({ cache_ttl: 1740000 });
        expect(targetOrigin).toBe(IFRAME_ORIGIN);
    });

    it("does not respond when ensureValidAuthTokens fails", async () => {
        vi.mocked(ensureValidAuthTokens).mockRejectedValue(new Error("Missing refresh token"));

        const iframeRef = makeIframeRef();
        renderHook(() => useOneScriptIframeHandshake(iframeRef, CONFIG));

        await act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "KACE_REINIT_REQUEST", requestId: "reinit-fail" },
                    source: iframeRef.current.contentWindow,
                }),
            );
        });

        await act(async () => {
            await Promise.resolve();
        });

        expect(ensureValidAuthTokens).toHaveBeenCalledTimes(1);
        expect(iframeRef.current.contentWindow.postMessage).not.toHaveBeenCalled();
    });

    it("ignores KACE_INIT_REQUEST from a source that is not the iframe", async () => {
        const iframeRef = makeIframeRef();
        renderHook(() => useOneScriptIframeHandshake(iframeRef, CONFIG));

        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "KACE_INIT_REQUEST", requestId: "req-spy" },
                }),
            );
        });

        expect(iframeRef.current.contentWindow.postMessage).not.toHaveBeenCalled();
    });

    it("pushes KACE_TOKENS_UPDATED when tokens change", () => {
        const iframeRef = makeIframeRef();
        const initialConfig = {
            ...CONFIG,
            params: { ...CONFIG.params, refresh_token: "rt-old" },
            tokens: { ...CONFIG.tokens, id_token: "id-old" },
        };

        const { rerender } = renderHook(({ config }) => useOneScriptIframeHandshake(iframeRef, config), {
            initialProps: { config: initialConfig },
        });

        iframeRef.current.contentWindow.postMessage.mockClear();

        rerender({
            config: {
                ...initialConfig,
                params: { ...initialConfig.params, refresh_token: "rt-new" },
                tokens: { ...initialConfig.tokens, id_token: "id-new" },
            },
        });

        const calls = iframeRef.current.contentWindow.postMessage.mock.calls;
        expect(calls.length).toBeGreaterThan(0);

        const [payload, targetOrigin] = calls[calls.length - 1];

        expect(payload.type).toBe("KACE_TOKENS_UPDATED");
        expect(payload.tokens).toEqual({
            id_token: "id-new",
            access_token: "acc",
            token_type: "Bearer",
            expires_in: 3600,
        });
        expect(payload.refresh_token).toBe("rt-new");
        expect(typeof payload.ts).toBe("number");
        expect(targetOrigin).toBe(IFRAME_ORIGIN);
    });
});
