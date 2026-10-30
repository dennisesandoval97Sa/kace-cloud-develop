import { describe, it, expect } from "vitest";
import { isAgentClientSearchVisible } from "./agentClientSearchVisibility";

describe("isAgentClientSearchVisible", () => {
    it("hides search when show_client_data is explicitly false", () => {
        expect(isAgentClientSearchVisible({ agent: { show_client_data: false } })).toBe(false);
    });

    it("shows search when show_client_data is explicitly true", () => {
        expect(isAgentClientSearchVisible({ agent: { show_client_data: true } })).toBe(true);
    });

    it("shows search for legacy tenants whose saved agent config has no show_client_data key", () => {
        expect(isAgentClientSearchVisible({ agent: { show_boards: false } })).toBe(true);
    });

    it("shows search from the flattened hook shape", () => {
        expect(isAgentClientSearchVisible({ show_client_data: true })).toBe(true);
        expect(isAgentClientSearchVisible({ show_client_data: false })).toBe(false);
    });

    it("ignores header.search_clients when deciding search visibility", () => {
        expect(
            isAgentClientSearchVisible({ header: { search_clients: false }, agent: { show_client_data: true } }),
        ).toBe(true);
        expect(
            isAgentClientSearchVisible({ header: { search_clients: true }, agent: { show_client_data: false } }),
        ).toBe(false);
    });

    it("hides search while the agent config is not loaded yet", () => {
        expect(isAgentClientSearchVisible(undefined)).toBe(false);
        expect(isAgentClientSearchVisible(null)).toBe(false);
    });
});
