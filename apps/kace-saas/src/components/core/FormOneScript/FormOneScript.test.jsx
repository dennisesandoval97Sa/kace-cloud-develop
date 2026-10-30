import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { FormOneScript } from "./FormOneScript";
import { ONESCRIPT_KONECTA_CLOUD } from "@/utils/URL";

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    dispatch: vi.fn(),
    invalidateQueries: vi.fn(),
    handleGeolocation: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
}));

vi.mock("react-redux", () => ({
    useDispatch: () => mocks.dispatch,
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        invalidateQueries: mocks.invalidateQueries,
        getQueryData: vi.fn(),
    }),
}));

vi.mock("@kace/hooks/useGeolocation", () => ({
    default: () => ({ handleGeolocation: mocks.handleGeolocation }),
}));

vi.mock("@kace/hooks/useAllowedConnections", () => ({
    default: () => ({ isAllowed: false, isLoading: false, error: null }),
}));

vi.mock("@kace/hooks/useConfigAgentData", () => ({
    default: () => ({ cases: {} }),
}));

vi.mock("@kace_v2/features/boards/hooks/useBoardCaseReturn.hook", () => ({
    default: () => () => null,
}));

vi.mock("sonner", () => ({
    toast: {
        info: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        default: vi.fn(),
        loading: vi.fn(),
        normal: vi.fn(),
        action: vi.fn(),
    },
}));

const captureMessageHandler = (spy) => {
    const call = spy.mock.calls.find(([event]) => event === "message");
    return call ? call[1] : undefined;
};

const dispatchMessage = (handler, { origin, data, source }) => {
    handler({ origin, data, source });
};

const renderFormOneScript = () => {
    const formRef = createRef();
    render(<FormOneScript formRef={formRef} url="https://onescript.example.com/form" />);
    const iframe = screen.getByTestId("form_onescript_iframe");
    return { iframe, contentWindow: iframe.contentWindow };
};

describe("FormOneScript message guard (KTSS-3388)", () => {
    let addEventListenerSpy;
    let removeEventListenerSpy;

    beforeEach(() => {
        addEventListenerSpy = vi.spyOn(window, "addEventListener");
        removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
        vi.clearAllMocks();
    });

    afterEach(() => {
        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });

    it("registers a 'message' listener on mount and removes it on unmount", () => {
        const formRef = createRef();
        const { unmount } = render(<FormOneScript formRef={formRef} url="https://onescript.example.com/form" />);
        const handler = captureMessageHandler(addEventListenerSpy);
        expect(handler).toBeDefined();
        unmount();
        expect(removeEventListenerSpy).toHaveBeenCalledWith("message", handler);
    });

    it("ignores a valid-origin message emitted by another iframe (KTSS-3388)", () => {
        const { contentWindow: ownWindow } = renderFormOneScript();
        const otherWindow = {};
        const handler = captureMessageHandler(addEventListenerSpy);

        dispatchMessage(handler, {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "ONESCRIPT_GO_BACK" },
            source: otherWindow,
        });

        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(mocks.invalidateQueries).not.toHaveBeenCalled();
        expect(ownWindow).not.toBe(otherWindow);
    });

    it("processes a valid-origin message emitted by its own iframe", () => {
        const { contentWindow } = renderFormOneScript();
        const handler = captureMessageHandler(addEventListenerSpy);

        dispatchMessage(handler, {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "ONESCRIPT_GO_BACK" },
            source: contentWindow,
        });

        expect(mocks.navigate).toHaveBeenCalledWith(-1);
        expect(mocks.invalidateQueries).toHaveBeenCalled();
    });

    it("ignores messages whose origin does not match ONESCRIPT_KONECTA_CLOUD, even from its own iframe", () => {
        const { contentWindow } = renderFormOneScript();
        const handler = captureMessageHandler(addEventListenerSpy);

        dispatchMessage(handler, {
            origin: "https://evil.example.com",
            data: { type: "ONESCRIPT_GO_BACK" },
            source: contentWindow,
        });

        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    });

    it("ignores messages when the iframe is not yet mounted (contentWindow undefined)", () => {
        const formRef = createRef();
        render(<FormOneScript formRef={formRef} url="https://onescript.example.com/form" />);
        const handler = captureMessageHandler(addEventListenerSpy);

        dispatchMessage(handler, {
            origin: ONESCRIPT_KONECTA_CLOUD,
            data: { type: "ONESCRIPT_GO_BACK" },
            source: undefined,
        });

        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    });
});
