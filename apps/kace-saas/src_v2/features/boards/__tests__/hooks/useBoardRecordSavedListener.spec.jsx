import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useBoardRecordSavedListener from "@kace_v2/features/boards/hooks/useBoardRecordSavedListener.hook";
import { ONESCRIPT_KONECTA_CLOUD } from "@/utils/URL";

const captureMessageHandler = (spy) => {
    const call = spy.mock.calls.find(([event]) => event === "message");
    return call ? call[1] : undefined;
};

const dispatchMessage = (handler, { origin, data }) => {
    handler({ origin, data });
};

describe("useBoardRecordSavedListener", () => {
    let addEventListenerSpy;
    let removeEventListenerSpy;

    beforeEach(() => {
        addEventListenerSpy = vi.spyOn(window, "addEventListener");
        removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    });

    afterEach(() => {
        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });

    it("registers a 'message' listener on mount", () => {
        const setSelectedEntity = vi.fn();
        renderHook(() => useBoardRecordSavedListener(setSelectedEntity));
        expect(addEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function));
    });

    it("removes the 'message' listener on unmount", () => {
        const setSelectedEntity = vi.fn();
        const { unmount } = renderHook(() => useBoardRecordSavedListener(setSelectedEntity));
        const handler = captureMessageHandler(addEventListenerSpy);
        expect(handler).toBeDefined();
        unmount();
        expect(removeEventListenerSpy).toHaveBeenCalledWith("message", handler);
    });

    it("registers the listener only once per hook instance", () => {
        const setSelectedEntity = vi.fn();
        const { rerender } = renderHook(() => useBoardRecordSavedListener(setSelectedEntity));
        rerender();
        const messageCalls = addEventListenerSpy.mock.calls.filter(([event]) => event === "message");
        expect(messageCalls).toHaveLength(1);
    });

    it("ignores messages whose origin does not match ONESCRIPT_KONECTA_CLOUD", () => {
        const setSelectedEntity = vi.fn();
        renderHook(() => useBoardRecordSavedListener(setSelectedEntity));
        const handler = captureMessageHandler(addEventListenerSpy);
        dispatchMessage(handler, {
            origin: "https://evil.example.com",
            data: { type: "KACE_BOARD_RECORD_SAVED", entity_id: "abc-123" },
        });
        expect(setSelectedEntity).not.toHaveBeenCalled();
    });

    it("ignores messages whose type is not KACE_BOARD_RECORD_SAVED", () => {
        const setSelectedEntity = vi.fn();
        renderHook(() => useBoardRecordSavedListener(setSelectedEntity));
        const handler = captureMessageHandler(addEventListenerSpy);
        dispatchMessage(handler, {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "OTHER_EVENT", entity_id: "abc-123" },
        });
        expect(setSelectedEntity).not.toHaveBeenCalled();
    });

    it("ignores messages without an entity_id", () => {
        const setSelectedEntity = vi.fn();
        renderHook(() => useBoardRecordSavedListener(setSelectedEntity));
        const handler = captureMessageHandler(addEventListenerSpy);
        dispatchMessage(handler, {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "KACE_BOARD_RECORD_SAVED" },
        });
        expect(setSelectedEntity).not.toHaveBeenCalled();
    });

    it("ignores messages with an empty-string entity_id", () => {
        const setSelectedEntity = vi.fn();
        renderHook(() => useBoardRecordSavedListener(setSelectedEntity));
        const handler = captureMessageHandler(addEventListenerSpy);
        dispatchMessage(handler, {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "KACE_BOARD_RECORD_SAVED", entity_id: "" },
        });
        expect(setSelectedEntity).not.toHaveBeenCalled();
    });

    it("ignores messages whose data is null", () => {
        const setSelectedEntity = vi.fn();
        renderHook(() => useBoardRecordSavedListener(setSelectedEntity));
        const handler = captureMessageHandler(addEventListenerSpy);
        dispatchMessage(handler, { origin: ONESCRIPT_KONECTA_CLOUD, data: null });
        expect(setSelectedEntity).not.toHaveBeenCalled();
    });

    it("calls setSelectedEntity with entity_id on a valid KACE_BOARD_RECORD_SAVED message", () => {
        const setSelectedEntity = vi.fn();
        renderHook(() => useBoardRecordSavedListener(setSelectedEntity));
        const handler = captureMessageHandler(addEventListenerSpy);
        dispatchMessage(handler, {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "KACE_BOARD_RECORD_SAVED", entity_id: "new-uuid-123" },
        });
        expect(setSelectedEntity).toHaveBeenCalledWith("new-uuid-123");
    });
});
