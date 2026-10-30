import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setIdSelected, setOpenModal } from "../../../redux/state/modalBehavior";
import { setReference } from "../../../redux/state/states";
import { useTranslation } from "react-i18next";
import usePermissionsUser from "@kace/hooks/usePermissionsUser";
import useConfigAgentData from "@kace/hooks/useConfigAgentData";
import useUserInformation from "@kace/hooks/useUserInformation";
import { toast } from "sonner";
import useCasesActions from "./useCasesActions";

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock("@/services/genericView", () => ({
    genericView: vi.fn().mockResolvedValue({}),
}));

vi.mock("react-redux", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useDispatch: vi.fn(),
    };
});

vi.mock("react-router-dom", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useNavigate: vi.fn(),
    };
});

vi.mock("../../../redux/state/modalBehavior", () => ({
    setIdSelected: vi.fn((id) => ({ type: "SET_ID_SELECTED", payload: id })),
    setOpenModal: vi.fn((isOpen) => ({ type: "SET_OPEN_MODAL", payload: isOpen })),
}));

vi.mock("../../../redux/state/states", () => ({
    setReference: vi.fn((reference) => ({ type: "SET_REFERENCE", payload: reference })),
}));

vi.mock("react-i18next", () => ({
    useTranslation: vi.fn(() => ({
        t: vi.fn((key) => `translated_${key}`),
    })),
}));

vi.mock("@kace/hooks/usePermissionsUser", () => ({
    default: vi.fn(({ actions }) => {
        return {
            arrayAction: actions.map((action) => ({
                ...action,
                handler: action.handler || vi.fn(),
            })),
        };
    }),
}));

vi.mock("@kace/hooks/useConfigAgentData", () => ({
    default: vi.fn(() => ({
        cases: {
            show_sheduler: false,
        },
    })),
}));

vi.mock("@kace/hooks/useUserInformation", () => ({
    default: vi.fn(() => ({ permissionsAgent: [], permissionsAdmin: [] })),
}));

/*
 * useCasesActions reads useQueryClient() directly (for prefetch/setQueryData in the
 * bulk-combined flow), so every renderHook needs a real QueryClientProvider ancestor.
 */
const wrapper = ({ children }) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return createElement(QueryClientProvider, { client: queryClient }, children);
};

const renderCasesActionsHook = () => renderHook(() => useCasesActions(), { wrapper });

describe("useCasesActions", () => {
    let mockDispatch;
    let mockNavigate;
    let mockUseTranslationT;

    beforeEach(() => {
        mockDispatch = vi.fn();
        useDispatch.mockReturnValue(mockDispatch);

        mockNavigate = vi.fn();
        useNavigate.mockReturnValue(mockNavigate);

        setIdSelected.mockClear();
        setOpenModal.mockClear();
        setReference.mockClear();

        mockUseTranslationT = vi.fn((key) => `translated_${key}`);
        useTranslation.mockReturnValue({ t: mockUseTranslationT });

        usePermissionsUser.mockClear();
        useConfigAgentData.mockReturnValue({ cases: { show_sheduler: false } });
        useUserInformation.mockReturnValue({ permissionsAgent: [], permissionsAdmin: [] });
    });

    describe("bulk capabilities", () => {
        const grantAdmin = (...names) =>
            useUserInformation.mockReturnValue({
                permissionsAgent: [],
                permissionsAdmin: names.map((name) => ({ module_id: "cases", name, granted: true })),
            });

        it("denies every bulk action without bulk permissions", () => {
            const { result } = renderCasesActionsHook();
            expect(result.current).toMatchObject({ canReassign: false, canChangeState: false, canClose: false });
        });

        it.each([
            ["CasesBulkAssign", "canReassign"],
            ["CasesBulkTransition", "canChangeState"],
            ["CasesBulkClose", "canClose"],
        ])("%s enables %s", (name, flag) => {
            grantAdmin(name);
            const { result } = renderCasesActionsHook();
            expect(result.current[flag]).toBe(true);
        });

        it("does not enable bulk reassign from the single-case CaseReclassify permission", () => {
            grantAdmin("CaseReclassify");
            const { result } = renderCasesActionsHook();
            expect(result.current.canReassign).toBe(false);
        });

        it("does not enable bulk state change from the agent CasesUpdate permission", () => {
            useUserInformation.mockReturnValue({
                permissionsAgent: [{ module_id: "cases", name: "CasesUpdate", granted: true }],
                permissionsAdmin: [],
            });
            const { result } = renderCasesActionsHook();
            expect(result.current.canChangeState).toBe(false);
        });
    });

    it("should return initial state values and arrayActions", () => {
        const { result } = renderCasesActionsHook();

        expect(result.current.type).toBe("");
        expect(result.current.title).toBe("");
        expect(result.current.description).toBe("");
        expect(result.current.arrayActions).toBeInstanceOf(Array);
        expect(result.current.arrayActions).toHaveLength(5);
        expect(result.current.arrayActions[0]).toHaveProperty("name", "CasesRead");
        expect(result.current.arrayActions.some((action) => action.name === "Calendario")).toBeFalsy();
        expect(result.current.arrayActions[0].handler).toBeInstanceOf(Function);
    });

    describe("action handlers (accessed via arrayActions)", () => {
        it("handleReassignCase (from arrayActions) dispatches correct actions and sets state", () => {
            const { result } = renderCasesActionsHook();
            const testId = "case123";

            const reassignAction = result.current.arrayActions.find((a) => a.name === "CaseReclassify");
            expect(reassignAction).toBeDefined();
            expect(reassignAction.handler).toBeInstanceOf(Function);

            act(() => {
                reassignAction.handler(testId);
            });

            expect(mockDispatch).toHaveBeenCalledTimes(2);
            expect(setIdSelected).toHaveBeenCalledWith(testId);
            expect(setOpenModal).toHaveBeenCalledWith(true);
            expect(result.current.type).toBe("reassign");
            expect(result.current.title).toBe("translated_actions.title.reassignCase");
            expect(result.current.description).toBe("translated_generalSetup.form.labels.reassignCaseAgent");
            expect(mockUseTranslationT).toHaveBeenCalledWith("generalSetup.form.labels.reassignCaseAgent");
        });

        it("handleCloseCase (from arrayActions) dispatches correct actions and sets state", () => {
            const { result } = renderCasesActionsHook();
            const testId = "case456";

            const closeAction = result.current.arrayActions.find((a) => a.name === "CaseClose");
            expect(closeAction).toBeDefined();
            expect(closeAction.handler).toBeInstanceOf(Function);

            act(() => {
                closeAction.handler(testId);
            });

            expect(mockDispatch).toHaveBeenCalledTimes(2);
            expect(setIdSelected).toHaveBeenCalledWith(testId);
            expect(setOpenModal).toHaveBeenCalledWith(true);
            expect(result.current.type).toBe("close");
            expect(result.current.title).toBe("translated_actions.title.closeCase");
            expect(result.current.description).toBe("translated_actions.labels.closeCase");
        });

        it("handleReopenCase (from arrayActions) dispatches correct actions and sets state", () => {
            const { result } = renderCasesActionsHook();
            const testId = "case789";

            const reopenAction = result.current.arrayActions.find((a) => a.name === "CaseReOpen");
            expect(reopenAction).toBeDefined();
            expect(reopenAction.handler).toBeInstanceOf(Function);

            act(() => {
                reopenAction.handler(testId);
            });

            expect(mockDispatch).toHaveBeenCalledTimes(2);
            expect(setIdSelected).toHaveBeenCalledWith(testId);
            expect(setOpenModal).toHaveBeenCalledWith(true);
            expect(result.current.type).toBe("reopen");
            expect(result.current.title).toBe("translated_actions.title.reopenCase");
            expect(result.current.description).toBe("translated_generalSetup.form.labels.reOpenCase");
            expect(mockUseTranslationT).toHaveBeenCalledWith("generalSetup.form.labels.reOpenCase");
        });

        it("handleCloneCase (from arrayActions) dispatches correct actions and sets state", () => {
            const { result } = renderCasesActionsHook();
            const testId = "case000";

            const cloneAction = result.current.arrayActions.find((a) => a.name === "CaseClone");
            expect(cloneAction).toBeDefined();
            expect(cloneAction.handler).toBeInstanceOf(Function);

            act(() => {
                cloneAction.handler(testId);
            });

            expect(mockDispatch).toHaveBeenCalledTimes(2);
            expect(setIdSelected).toHaveBeenCalledWith(testId);
            expect(setOpenModal).toHaveBeenCalledWith(true);
            expect(result.current.type).toBe("clone");
            expect(result.current.title).toBe("translated_actions.title.cloneCase");
            expect(result.current.description).toBe("translated_actions.labels.cloneCase");
        });

        it("handleSeeCase (from arrayActions) dispatches setReference and navigates", () => {
            const { result } = renderCasesActionsHook();
            const testId = "case-view-1";
            const testReference = "REF-XYZ";

            const seeCaseAction = result.current.arrayActions.find((a) => a.name === "CasesRead");
            expect(seeCaseAction).toBeDefined();
            expect(seeCaseAction.handler).toBeInstanceOf(Function);

            act(() => {
                seeCaseAction.handler(testId, testReference);
            });

            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(setReference).toHaveBeenCalledWith(testReference);
            expect(mockNavigate).toHaveBeenCalledWith(`/cases/update/${testId}`);
        });

        it("handleCalendarCase (from arrayActions) navigates to calendar URL when enabled", () => {
            useConfigAgentData.mockReturnValue({ cases: { show_sheduler: true } });

            const { result } = renderCasesActionsHook();

            const calendarAction = result.current.arrayActions.find((a) => a.name === "Calendario");
            expect(calendarAction).toBeDefined();
            expect(calendarAction.action).toBeInstanceOf(Function);

            const testId = "case-cal-1";
            act(() => {
                calendarAction.action(testId);
            });

            expect(mockNavigate).toHaveBeenCalledWith(`/cases/calendar/${testId}`);
        });

        it("handleCalendarCase is not included when show_sheduler is false", () => {
            const { result } = renderCasesActionsHook();
            const calendarAction = result.current.arrayActions.find((a) => a.name === "Calendario");
            expect(calendarAction).toBeUndefined();
            expect(result.current.arrayActions).toHaveLength(5);
        });
    });

    describe("arrayActions generation", () => {
        it("should include actions from usePermissionsUser with correct handlers", () => {
            const { result } = renderCasesActionsHook();

            expect(result.current.arrayActions).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ name: "CasesRead", label: "Ver caso", handler: expect.any(Function) }),
                    expect.objectContaining({ name: "CaseClose", label: "Cerrar caso", handler: expect.any(Function) }),
                    expect.objectContaining({
                        name: "CaseReclassify",
                        label: "Re-asignar caso",
                        handler: expect.any(Function),
                    }),
                    expect.objectContaining({ name: "CaseClone", label: "Clonar caso", handler: expect.any(Function) }),
                    expect.objectContaining({
                        name: "CaseReOpen",
                        label: "Re-abrir caso",
                        handler: expect.any(Function),
                    }),
                ]),
            );
            expect(result.current.arrayActions).toHaveLength(5);
        });

        it("should include Calendar action when show_sheduler is true", () => {
            useConfigAgentData.mockReturnValue({
                cases: {
                    show_sheduler: true,
                },
            });
            usePermissionsUser.mockReturnValue({ arrayAction: [] });

            const { result } = renderCasesActionsHook();

            expect(result.current.arrayActions).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: "Calendario",
                        action: expect.any(Function),
                        customizable: false,
                    }),
                ]),
            );
            expect(result.current.arrayActions).toHaveLength(1);
        });

        it("should not include Calendar action when show_sheduler is false", () => {
            useConfigAgentData.mockReturnValue({ cases: { show_sheduler: false } });
            usePermissionsUser.mockReturnValue({ arrayAction: [] });

            const { result } = renderCasesActionsHook();

            expect(result.current.arrayActions).toEqual([]);
        });

        it("should include both permission-based and calendar actions when both are present", () => {
            usePermissionsUser.mockReturnValue({
                arrayAction: [{ name: "CaseCreate", label: "Create Case", handler: vi.fn() }],
            });
            useConfigAgentData.mockReturnValue({
                cases: {
                    show_sheduler: true,
                },
            });

            const { result } = renderCasesActionsHook();

            expect(result.current.arrayActions).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: "CaseCreate",
                        label: "Create Case",
                        handler: expect.any(Function),
                    }),
                    expect.objectContaining({ name: "Calendario", action: expect.any(Function) }),
                ]),
            );
            expect(result.current.arrayActions).toHaveLength(2);
        });
    });

    describe("handleBulkCombinedAction", () => {
        let testQueryClient;

        beforeEach(() => {
            testQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        });

        it("clears selectedCaseData and sets selectedCases when valid cases are provided", () => {
            testQueryClient.setQueryData(["selectedCaseData"], { data: { id: "residual-case" } });
            const customWrapper = ({ children }) =>
                createElement(QueryClientProvider, { client: testQueryClient }, children);

            const { result } = renderHook(() => useCasesActions(), { wrapper: customWrapper });

            const cases = [
                { id: "case-1", fecha_resolucion: null },
                { id: "case-2", fecha_resolucion: null },
            ];

            act(() => {
                result.current.handleBulkCombinedAction(cases);
            });

            expect(testQueryClient.getQueryData(["selectedCaseData"])).toBeNull();
            expect(testQueryClient.getQueryData(["selectedCases"])).toEqual(cases);
            expect(mockDispatch).toHaveBeenCalledWith(setOpenModal(true));
            expect(result.current.type).toBe("combined_bulk");
            expect(result.current.title).toBe("translated_combinedBulkActions.title");
            expect(result.current.description).toBe("translated_combinedBulkActions.description");
        });

        it("does nothing when cases array is empty or undefined", () => {
            const customWrapper = ({ children }) =>
                createElement(QueryClientProvider, { client: testQueryClient }, children);

            const { result } = renderHook(() => useCasesActions(), { wrapper: customWrapper });

            act(() => {
                result.current.handleBulkCombinedAction([]);
            });

            expect(mockDispatch).not.toHaveBeenCalled();
            expect(result.current.type).toBe("");
        });

        it("shows error toast and does not open modal when some cases are closed", () => {
            const customWrapper = ({ children }) =>
                createElement(QueryClientProvider, { client: testQueryClient }, children);

            const { result } = renderHook(() => useCasesActions(), { wrapper: customWrapper });

            const cases = [
                { id: "case-1", fecha_resolucion: null },
                { id: "case-2", fecha_resolucion: "2026-09-01T00:00:00Z" },
            ];

            act(() => {
                result.current.handleBulkCombinedAction(cases);
            });

            expect(toast.error).toHaveBeenCalledWith("translated_errors.cases.closedBulkAction");
            expect(mockDispatch).not.toHaveBeenCalled();
            expect(result.current.type).toBe("");
        });
    });
});
