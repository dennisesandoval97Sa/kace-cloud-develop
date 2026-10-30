import { createElement } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { sendInformation } from "../../../../../../../services/generic-send-information";
import { useReopenCase } from "./useReOpenCase";
import useSelectedCase from "../../../hooks/useSelectedCase";

const dispatch = vi.fn();

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, options) =>
            key === "app.errors.public.CASE_REOPEN_WINDOW_EXCEEDED"
                ? "reopen window exceeded"
                : (options?.defaultValue ?? key),
    }),
}));

vi.mock("react-redux", () => ({
    useDispatch: () => dispatch,
}));

vi.mock("@/redux/state/modalBehavior", () => ({
    setOpenModal: (open) => ({ type: "SET_OPEN_MODAL", payload: open }),
}));

vi.mock("../../../hooks/useSelectedCase", () => ({
    default: vi.fn(() => ({ caseSelect: { data: { id: "case-1" } } })),
}));

vi.mock("../../../../../../../services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

const wrapper = ({ children }) =>
    createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) },
        children,
    );

describe("useReopenCase", () => {
    beforeEach(() => {
        vi.mocked(sendInformation).mockReset();
        toast.success.mockClear();
        toast.error.mockClear();
        dispatch.mockClear();
        vi.mocked(useSelectedCase).mockReturnValue({ caseSelect: { data: { id: "case-1" } } });
    });

    it("sends the comment and transition in a single reopen request", async () => {
        vi.mocked(sendInformation).mockResolvedValueOnce({ status: 200 });
        const { result } = renderHook(() => useReopenCase(), { wrapper });

        await result.current.handleReopenCase({
            transicion_id: "transition-1",
            descripcion: "Reabrir el caso",
        });

        expect(sendInformation).toHaveBeenCalledTimes(1);
        expect(vi.mocked(sendInformation).mock.calls[0][0]).toEqual({
            url: "/case-re-open/case-1",
            dataPost: {
                transicion_id: "transition-1",
                comment: {
                    descripcion: "Reabrir el caso",
                },
            },
        });
        expect(toast.success).toHaveBeenCalledWith("genericTexts.EverythingOk");
        expect(dispatch).toHaveBeenCalledWith({ type: "SET_OPEN_MODAL", payload: false });
    });

    it("shows a translated toast when the reopen API fails", async () => {
        vi.mocked(sendInformation).mockRejectedValueOnce({
            response: { data: { data: { code: "0x030047", days: 7 } } },
        });
        const { result } = renderHook(() => useReopenCase(), { wrapper });

        await result.current.handleReopenCase({
            transicion_id: "transition-1",
            descripcion: "Reabrir el caso",
        });

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("reopen window exceeded");
        });
        expect(toast.success).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
    });

    it("shows a generic toast when there is no selected case", async () => {
        vi.mocked(useSelectedCase).mockReturnValueOnce({ caseSelect: { data: {} } });
        const { result } = renderHook(() => useReopenCase(), { wrapper });

        await result.current.handleReopenCase({
            transicion_id: "transition-1",
            descripcion: "Reabrir el caso",
        });

        expect(sendInformation).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith("app.errors.generic");
    });
});
