import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { toast } from "sonner";
import { useReassignCase } from "./useReassignCase";
import { runCaseBulkChunks } from "@kace_v2/features/boards/utils/boardCasesBulk.utils";

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, options) => {
            if (options && options.assigned !== undefined) {
                return `Assigned: ${options.assigned}, Skipped: ${options.skipped}`;
            }
            if (
                key === "boards.bulkActions.apiErrors.couldNotAssignResponsible" ||
                key === "app.errors.public.CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE"
            ) {
                return "Translated couldNotAssignResponsible";
            }
            return options?.defaultValue || key;
        },
    }),
}));

const mockDispatch = vi.fn();
vi.mock("react-redux", () => ({
    useDispatch: () => mockDispatch,
}));

const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
    useMutation: () => ({
        mutateAsync: vi.fn(),
        isPending: false,
    }),
}));

const mockClearSelectedCases = vi.fn();
let mockSelectedCases = [{ id: "case-1" }, { id: "case-2" }];
let mockCaseSelect = null;

vi.mock("@/pages/Cases/hooks/useSelectedCases", () => ({
    default: () => ({
        selectedCases: mockSelectedCases,
        clearSelectedCases: mockClearSelectedCases,
    }),
}));

vi.mock("../../../hooks/useSelectedCase", () => ({
    default: () => ({
        caseSelect: mockCaseSelect,
    }),
}));

vi.mock("@kace_v2/features/boards/services/cases-bulk.service", () => ({
    postCasesBulkAssign: vi.fn(),
}));

vi.mock("@kace_v2/features/boards/utils/boardCasesBulk.utils", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        runCaseBulkChunks: vi.fn(),
    };
});

describe("useReassignCase", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSelectedCases = [{ id: "case-1" }, { id: "case-2" }];
        mockCaseSelect = null;
    });

    it("emits toast.warning when all cases are skipped due to unavailable responsible", async () => {
        runCaseBulkChunks.mockResolvedValueOnce({
            processedCount: 2,
            successIds: [],
            responses: [
                {
                    data: {
                        message: "Ok",
                        data: {},
                        metadata: { assignedCount: 0, skippedCount: 2 },
                        code: "0x030043",
                    },
                },
            ],
        });

        const { result } = renderHook(() => useReassignCase());

        await act(async () => {
            await result.current.handleReassignGroup({ grupo_id: "group-1" });
        });

        expect(toast.warning).toHaveBeenCalledWith("Translated couldNotAssignResponsible");
        expect(toast.error).not.toHaveBeenCalled();
        expect(mockClearSelectedCases).not.toHaveBeenCalled();
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("emits toast.warning with breakdown when partial cases are skipped", async () => {
        runCaseBulkChunks.mockResolvedValueOnce({
            processedCount: 2,
            successIds: ["case-1"],
            responses: [
                {
                    data: {
                        message: "Ok",
                        data: {},
                        metadata: { assignedCount: 1, skippedCount: 1 },
                        code: "0x030043",
                    },
                },
            ],
        });

        const { result } = renderHook(() => useReassignCase());

        await act(async () => {
            await result.current.handleReassignGroup({ grupo_id: "group-1" });
        });

        expect(toast.warning).toHaveBeenCalledWith("Assigned: 1, Skipped: 1");
        expect(toast.error).not.toHaveBeenCalled();
    });

    it("emits toast.success when all cases are assigned successfully", async () => {
        runCaseBulkChunks.mockResolvedValueOnce({
            processedCount: 2,
            successIds: ["case-1", "case-2"],
            responses: [
                {
                    data: {
                        message: "Ok",
                        data: {},
                        metadata: { assignedCount: 2, skippedCount: 0 },
                    },
                },
            ],
        });

        const { result } = renderHook(() => useReassignCase());

        await act(async () => {
            await result.current.handleReassignGroup({ grupo_id: "group-1" });
        });

        expect(toast.success).toHaveBeenCalledWith("genericTexts.EverythingOk");
        expect(toast.warning).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
    });

    it("emits toast.warning instead of toast.error when error matches unavailable responsible", async () => {
        const error = new Error("Could not assign a person responsible");
        error.response = {
            data: {
                message: "Could not assign a person responsible",
                code: "0x030005",
            },
        };
        runCaseBulkChunks.mockRejectedValueOnce(error);

        const { result } = renderHook(() => useReassignCase());

        await act(async () => {
            await result.current.handleReassignGroup({ grupo_id: "group-1" });
        });

        expect(toast.warning).toHaveBeenCalledWith("Translated couldNotAssignResponsible");
        expect(toast.error).not.toHaveBeenCalled();
        expect(mockClearSelectedCases).toHaveBeenCalled();
    });

    it("returns correct failure state in combined mode when all cases are skipped", async () => {
        runCaseBulkChunks.mockResolvedValueOnce({
            processedCount: 2,
            successIds: ["case-1", "case-2"],
            responses: [
                {
                    data: {
                        message: "Ok",
                        data: {},
                        metadata: { assignedCount: 0, skippedCount: 2 },
                        code: "0x030043",
                    },
                },
            ],
        });

        const { result } = renderHook(() => useReassignCase());
        let outcome;

        await act(async () => {
            outcome = await result.current.handleReassignGroup({ grupo_id: "group-1" }, { combined: true });
        });

        expect(outcome).toEqual({
            processed: 0,
            total: 2,
            successIds: [],
            failedIds: ["case-1", "case-2"],
        });
        expect(mockClearSelectedCases).not.toHaveBeenCalled();
    });

    it("returns partial failure state in combined mode when some cases are skipped", async () => {
        runCaseBulkChunks.mockResolvedValueOnce({
            processedCount: 2,
            successIds: ["case-1", "case-2"],
            responses: [
                {
                    data: {
                        message: "Ok",
                        data: {},
                        metadata: { assignedCount: 1, skippedCount: 1 },
                        code: "0x030043",
                    },
                },
            ],
        });

        const { result } = renderHook(() => useReassignCase());
        let outcome;

        await act(async () => {
            outcome = await result.current.handleReassignGroup({ grupo_id: "group-1" }, { combined: true });
        });

        expect(outcome).toEqual({
            processed: 1,
            total: 2,
            successIds: ["case-1"],
            failedIds: ["case-2"],
        });
        expect(mockClearSelectedCases).not.toHaveBeenCalled();
    });

    it("uses selectedCases IDs when caseSelect is null (bulk selection flow)", async () => {
        mockCaseSelect = null;
        mockSelectedCases = [{ id: "case-1" }, { id: "case-2" }, { id: "case-3" }];
        runCaseBulkChunks.mockResolvedValueOnce({
            processedCount: 3,
            successIds: ["case-1", "case-2", "case-3"],
            responses: [],
        });

        const { result } = renderHook(() => useReassignCase());

        await act(async () => {
            await result.current.handleReassignGroup({ grupo_id: "group-1" });
        });

        expect(runCaseBulkChunks).toHaveBeenCalledWith(
            ["case-1", "case-2", "case-3"],
            expect.any(Function),
            expect.any(Function),
        );
    });

    it("uses single case ID when caseSelect is present", async () => {
        mockCaseSelect = { data: { id: "single-case" } };
        mockSelectedCases = [];
        runCaseBulkChunks.mockResolvedValueOnce({
            processedCount: 1,
            successIds: ["single-case"],
            responses: [],
        });

        const { result } = renderHook(() => useReassignCase());

        await act(async () => {
            await result.current.handleReassignGroup({ grupo_id: "group-1" });
        });

        expect(runCaseBulkChunks).toHaveBeenCalledWith(["single-case"], expect.any(Function), expect.any(Function));
    });
});
