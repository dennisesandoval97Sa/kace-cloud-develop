import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useBoardCustomFilterMessage from "@kace_v2/features/boards/hooks/useBoardCustomFilterMessage.hook";
import { ONESCRIPT_KONECTA_CLOUD } from "@/utils/URL";

const captureMessageHandler = (spy) => {
    const call = spy.mock.calls.find(([event]) => event === "message");
    return call ? call[1] : undefined;
};

const dispatchMessage = (handler, { origin, data, source }) => {
    handler({ origin, data, source });
};

const buildIframeRef = () => {
    const contentWindow = {};
    return { ref: { current: { contentWindow } }, contentWindow };
};

const PAYLOAD = [{ field: "cases.expediente", operator: "eq", type: "AND", value: "102608180123" }];

describe("useBoardCustomFilterMessage", () => {
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
        const { ref } = buildIframeRef();
        renderHook(() => useBoardCustomFilterMessage(ref, vi.fn()));
        expect(addEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function));
    });

    it("removes the 'message' listener on unmount", () => {
        const { ref } = buildIframeRef();
        const { unmount } = renderHook(() => useBoardCustomFilterMessage(ref, vi.fn()));
        const handler = captureMessageHandler(addEventListenerSpy);
        expect(handler).toBeDefined();
        unmount();
        expect(removeEventListenerSpy).toHaveBeenCalledWith("message", handler);
    });

    it("does not register a listener while disabled", () => {
        const { ref } = buildIframeRef();
        renderHook(() => useBoardCustomFilterMessage(ref, vi.fn(), false));
        const messageCalls = addEventListenerSpy.mock.calls.filter(([event]) => event === "message");
        expect(messageCalls).toHaveLength(0);
    });

    it("ignores messages whose origin does not match ONESCRIPT_KONECTA_CLOUD", () => {
        const { ref, contentWindow } = buildIframeRef();
        const onFilter = vi.fn();
        renderHook(() => useBoardCustomFilterMessage(ref, onFilter));
        dispatchMessage(captureMessageHandler(addEventListenerSpy), {
            origin: "https://evil.example.com",
            data: { type: "boardFilterData", payload: PAYLOAD },
            source: contentWindow,
        });
        expect(onFilter).not.toHaveBeenCalled();
    });

    it("ignores messages whose type is not boardFilterData", () => {
        const { ref, contentWindow } = buildIframeRef();
        const onFilter = vi.fn();
        renderHook(() => useBoardCustomFilterMessage(ref, onFilter));
        dispatchMessage(captureMessageHandler(addEventListenerSpy), {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "userFormData", payload: PAYLOAD },
            source: contentWindow,
        });
        expect(onFilter).not.toHaveBeenCalled();
    });

    it("ignores messages whose payload is not an array", () => {
        const { ref, contentWindow } = buildIframeRef();
        const onFilter = vi.fn();
        renderHook(() => useBoardCustomFilterMessage(ref, onFilter));
        dispatchMessage(captureMessageHandler(addEventListenerSpy), {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "boardFilterData", payload: { field: "cases.expediente" } },
            source: contentWindow,
        });
        expect(onFilter).not.toHaveBeenCalled();
    });

    it("ignores messages whose data is null", () => {
        const { ref, contentWindow } = buildIframeRef();
        const onFilter = vi.fn();
        renderHook(() => useBoardCustomFilterMessage(ref, onFilter));
        dispatchMessage(captureMessageHandler(addEventListenerSpy), {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: null,
            source: contentWindow,
        });
        expect(onFilter).not.toHaveBeenCalled();
    });

    it("ignores a valid message emitted by another board's iframe", () => {
        const { ref } = buildIframeRef();
        const other = buildIframeRef();
        const onFilter = vi.fn();
        renderHook(() => useBoardCustomFilterMessage(ref, onFilter));
        dispatchMessage(captureMessageHandler(addEventListenerSpy), {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "boardFilterData", payload: PAYLOAD },
            source: other.contentWindow,
        });
        expect(onFilter).not.toHaveBeenCalled();
    });

    it("ignores messages when its own iframe is not mounted", () => {
        const onFilter = vi.fn();
        renderHook(() => useBoardCustomFilterMessage({ current: null }, onFilter));
        dispatchMessage(captureMessageHandler(addEventListenerSpy), {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "boardFilterData", payload: PAYLOAD },
            source: undefined,
        });
        expect(onFilter).not.toHaveBeenCalled();
    });

    it("calls onFilter with the payload emitted by its own iframe", () => {
        const { ref, contentWindow } = buildIframeRef();
        const onFilter = vi.fn();
        renderHook(() => useBoardCustomFilterMessage(ref, onFilter));
        dispatchMessage(captureMessageHandler(addEventListenerSpy), {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "boardFilterData", payload: PAYLOAD },
            source: contentWindow,
        });
        expect(onFilter).toHaveBeenCalledWith(PAYLOAD);
    });

    it("accepts an empty payload emitted by its own iframe", () => {
        const { ref, contentWindow } = buildIframeRef();
        const onFilter = vi.fn();
        renderHook(() => useBoardCustomFilterMessage(ref, onFilter));
        dispatchMessage(captureMessageHandler(addEventListenerSpy), {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "boardFilterData", payload: [] },
            source: contentWindow,
        });
        expect(onFilter).toHaveBeenCalledWith([]);
    });
});
