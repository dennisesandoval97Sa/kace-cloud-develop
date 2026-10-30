import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useBoardCaseReturn from "@kace_v2/features/boards/hooks/useBoardCaseReturn.hook";

const { mockLocation, mockConfigAgentData } = vi.hoisted(() => ({
    mockLocation: vi.fn(),
    mockConfigAgentData: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useLocation: () => mockLocation(),
}));

vi.mock("@kace/hooks/useConfigAgentData", () => ({
    default: () => mockConfigAgentData(),
}));

const CASE_ID = "case-uuid-1";
const SAVE_ROUTE = `/agent/update/${CASE_ID}?action=edit`;

const setLocation = ({ pathname = `/agent/update/${CASE_ID}`, search = "?action=edit&board_id=board-1", state } = {}) =>
    mockLocation.mockReturnValue({ pathname, search, state });

const setConfig = (return_to_board_on_case_saved) =>
    mockConfigAgentData.mockReturnValue({ cases: { return_to_board_on_case_saved } });

const renderResolver = () => renderHook(() => useBoardCaseReturn()).result.current;

describe("useBoardCaseReturn", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setConfig(true);
        setLocation();
    });

    it("returns null when the group setting is disabled", () => {
        setConfig(false);
        expect(renderResolver()(SAVE_ROUTE)).toBeNull();
    });

    it("returns null when the config is not loaded yet", () => {
        mockConfigAgentData.mockReturnValue({ cases: null });
        expect(renderResolver()(SAVE_ROUTE)).toBeNull();
    });

    it("returns null outside the agent case route", () => {
        setLocation({ pathname: `/cases/update/${CASE_ID}`, search: "?role=administrador&board_id=board-1" });
        expect(renderResolver()(SAVE_ROUTE)).toBeNull();
    });

    it("returns null when the case was not opened from a board (no board_id)", () => {
        setLocation({ search: "?action=edit" });
        expect(renderResolver()(SAVE_ROUTE)).toBeNull();
    });

    it("returns null when the message points to a different case", () => {
        expect(renderResolver()("/agent/update/another-case?action=edit")).toBeNull();
    });

    it("returns null when the message carries no route string", () => {
        expect(renderResolver()(undefined)).toBeNull();
    });

    it("returns the origin view captured when the case was opened", () => {
        setLocation({ state: { boardReturnTo: "/agent/client-uuid-9" } });
        expect(renderResolver()(SAVE_ROUTE)).toBe("/agent/client-uuid-9");
    });

    it("falls back to /agent when there is no navigation state (e.g. after a page reload)", () => {
        expect(renderResolver()(SAVE_ROUTE)).toBe("/agent");
    });

    it("falls back to /agent when the stored origin is protocol-relative", () => {
        setLocation({ state: { boardReturnTo: "//evil.example.com" } });
        expect(renderResolver()(SAVE_ROUTE)).toBe("/agent");
    });

    it("falls back to /agent when the stored origin uses a backslash", () => {
        setLocation({ state: { boardReturnTo: "/\\evil.example.com" } });
        expect(renderResolver()(SAVE_ROUTE)).toBe("/agent");
    });

    it("falls back to /agent when the stored origin is an absolute URL", () => {
        setLocation({ state: { boardReturnTo: "https://evil.example.com/agent" } });
        expect(renderResolver()(SAVE_ROUTE)).toBe("/agent");
    });
});
