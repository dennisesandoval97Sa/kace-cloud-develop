import { renderHook } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useLoadedAgentClientId } from "./useLoadedAgentClientId";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

const wrapperFor = (path) =>
    function Wrapper({ children }) {
        return (
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/agent" element={children} />
                    <Route path="/agent/:clientId" element={children} />
                </Routes>
            </MemoryRouter>
        );
    };

describe("useLoadedAgentClientId", () => {
    it("returns the UUID from /agent/:clientId", () => {
        const { result } = renderHook(() => useLoadedAgentClientId(), { wrapper: wrapperFor(`/agent/${CLIENT_ID}`) });
        expect(result.current).toBe(CLIENT_ID);
    });

    it("returns null on /agent so the AgentContext draft UUID is never used", () => {
        const { result } = renderHook(() => useLoadedAgentClientId(), { wrapper: wrapperFor("/agent") });
        expect(result.current).toBeNull();
    });

    it("returns null when the route param is not a UUID", () => {
        const { result } = renderHook(() => useLoadedAgentClientId(), { wrapper: wrapperFor("/agent/not-a-uuid") });
        expect(result.current).toBeNull();
    });
});
