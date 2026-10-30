import { createElement } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { sendInformation } from "@/services/generic-send-information";
import { postCasesBulkClose } from "@kace_v2/features/boards/services/cases-bulk.service";
import useSelectedCase from "../../../hooks/useSelectedCase";
import useSelectedCases from "@/pages/Cases/hooks/useSelectedCases";
import useCaseClose from "./useCaseClose";

const dispatch = vi.fn();
const clearSelectedCases = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
vi.mock("react-redux", () => ({ useDispatch: () => dispatch }));
vi.mock("@/redux/state/modalBehavior", () => ({
    setOpenModal: (open) => ({ type: "SET_OPEN_MODAL", payload: open }),
}));
vi.mock("@/services/generic-send-information", () => ({ sendInformation: vi.fn() }));
vi.mock("@kace_v2/features/boards/services/cases-bulk.service", () => ({ postCasesBulkClose: vi.fn() }));
vi.mock("../../../hooks/useSelectedCase", () => ({ default: vi.fn() }));
vi.mock("@/pages/Cases/hooks/useSelectedCases", () => ({ default: vi.fn() }));

const wrapper = ({ children }) =>
    createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) },
        children,
    );

describe("useCaseClose", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useSelectedCase).mockReturnValue({ caseSelect: { data: { id: "case-1" } } });
        vi.mocked(useSelectedCases).mockReturnValue({ selectedCases: [], clearSelectedCases });
    });

    it("closes a single case through the individual endpoint, not the bulk route", async () => {
        vi.mocked(sendInformation).mockResolvedValueOnce({ status: 200 });
        const { result } = renderHook(() => useCaseClose(), { wrapper });

        await result.current.handleCaseClose({ motivo_baja: "Resolved by phone" });

        expect(sendInformation).toHaveBeenCalledTimes(1);
        expect(vi.mocked(sendInformation).mock.calls[0][0]).toEqual({
            url: "/case-close/case-1",
            dataPost: { motivo_baja: "Resolved by phone" },
        });
        expect(postCasesBulkClose).not.toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith("genericTexts.EverythingOk");
        expect(dispatch).toHaveBeenCalledWith({ type: "SET_OPEN_MODAL", payload: false });
    });

    it("closes a selection through the bulk endpoint", async () => {
        vi.mocked(useSelectedCases).mockReturnValue({
            selectedCases: [{ id: "case-1" }, { id: "case-2" }],
            clearSelectedCases,
        });
        vi.mocked(postCasesBulkClose).mockResolvedValueOnce({ status: 200 });
        const { result } = renderHook(() => useCaseClose(), { wrapper });

        await result.current.handleCaseClose({ motivo_baja: "Duplicated" });

        expect(vi.mocked(postCasesBulkClose).mock.calls[0][0]).toEqual({
            case_ids: ["case-1", "case-2"],
            close_reason: "Duplicated",
        });
        expect(sendInformation).not.toHaveBeenCalled();
    });

    it("keeps using the bulk endpoint for combined bulk actions", async () => {
        vi.mocked(useSelectedCases).mockReturnValue({ selectedCases: [{ id: "case-1" }], clearSelectedCases });
        vi.mocked(postCasesBulkClose).mockResolvedValueOnce({ status: 200 });
        const { result } = renderHook(() => useCaseClose(), { wrapper });

        const outcome = await result.current.handleCaseClose({ motivo_baja: "Duplicated" }, { combined: true });

        expect(postCasesBulkClose).toHaveBeenCalledTimes(1);
        expect(sendInformation).not.toHaveBeenCalled();
        expect(outcome).toEqual({ processed: 1, total: 1, successIds: ["case-1"], failedIds: [] });
    });

    it("shows an error toast when the individual close fails", async () => {
        vi.mocked(sendInformation).mockRejectedValueOnce(new Error("boom"));
        const { result } = renderHook(() => useCaseClose(), { wrapper });

        await result.current.handleCaseClose({ motivo_baja: "Resolved by phone" });

        expect(toast.error).toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
        expect(clearSelectedCases).toHaveBeenCalled();
    });
});
