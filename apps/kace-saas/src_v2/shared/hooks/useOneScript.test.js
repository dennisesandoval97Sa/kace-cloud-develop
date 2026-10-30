import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import useUserInformation from "@kace/hooks/useUserInformation";
import useOneScript from "./useOneScript";

vi.mock("@kace/hooks/useUserInformation", () => ({
    default: vi.fn(() => ({
        user: { id: "user123" },
        active_group_id: "11111111-1111-1111-1111-111111111111",
    })),
}));

vi.mock("@/cognito-auth/AuthContext", () => ({
    useAuth: () => ({ fingerprint: "fp-test" }),
}));

vi.mock("@kace_v2/shared/services/oneScript.service", () => ({
    fetchOneScript: vi.fn(() => Promise.resolve({ url: "https://onescript.example.com" })),
}));

vi.mock("@kace_v2/shared/hooks/useOneScriptIframeHandshake", () => ({
    useOneScriptIframeHandshake: vi.fn(),
}));

const makeWrapper = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }) => React.createElement(QueryClientProvider, { client: qc }, children);
};

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("tokens", JSON.stringify({ refresh_token: "token-abc" }));
    vi.mocked(useUserInformation).mockReturnValue({
        user: { id: "user123" },
        active_group_id: "11111111-1111-1111-1111-111111111111",
    });
});

describe("useOneScript — clean URL (postMessage architecture)", () => {
    it("returns the base URL without any auth params", async () => {
        const { result } = renderHook(() => useOneScript("form-id-1"), { wrapper: makeWrapper() });

        await waitFor(() => expect(result.current.oneScriptURL).not.toBeNull());

        expect(result.current.oneScriptURL).toBe("https://onescript.example.com");
        expect(result.current.oneScriptURL).not.toContain("refresh_token");
        expect(result.current.oneScriptURL).not.toContain("fingerprint");
        expect(result.current.oneScriptURL).not.toContain("user_id");
        expect(result.current.oneScriptURL).not.toContain("grupo_activo");

        const { useOneScriptIframeHandshake } = await import("@kace_v2/shared/hooks/useOneScriptIframeHandshake");
        expect(useOneScriptIframeHandshake).toHaveBeenCalledWith(
            expect.any(Object), // oneScriptRef
            expect.objectContaining({
                enabled: true,
                params: expect.objectContaining({
                    refresh_token: "token-abc",
                    user_id: "user123",
                }),
                tokens: expect.objectContaining({
                    id_token: null,
                }),
            }),
        );
    });

    it("returns null when form data is not yet loaded", async () => {
        const { fetchOneScript } = await import("@kace_v2/shared/services/oneScript.service");
        vi.mocked(fetchOneScript).mockResolvedValueOnce(null);

        const { result } = renderHook(() => useOneScript("form-id-1"), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

        expect(result.current.oneScriptURL).toBeNull();
    });
});
