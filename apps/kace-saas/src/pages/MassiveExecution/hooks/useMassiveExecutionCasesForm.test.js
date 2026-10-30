import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { toast } from "sonner";
import useMassiveExecutionCasesForm from "./useMassiveExecutionCasesForm";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("react-redux", () => ({
    useSelector: vi.fn(() => []),
}));

vi.mock("sonner", () => ({
    toast: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
    },
}));

vi.mock("../../../services/genericSearchService", () => ({
    genericSearchService: vi.fn(),
}));

vi.mock("../../../services/genericHandleSendInformation", () => ({
    genericHandleSendInformation: vi.fn((data) => data),
}));

vi.mock("../../../services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

const mockSetQueryData = vi.fn();
const mockFetchQuery = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockMutate = vi.fn();

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        setQueryData: mockSetQueryData,
        fetchQuery: mockFetchQuery,
        invalidateQueries: mockInvalidateQueries,
    }),
}));

vi.mock("../../../hooks/useGeneralMutation", () => ({
    default: () => ({
        mutate: mockMutate,
        isSuccess: false,
        isError: false,
        isPending: false,
    }),
}));

describe("useMassiveExecutionCasesForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("displays an info toast when submitting without a file", async () => {
        const { result } = renderHook(() => useMassiveExecutionCasesForm());

        await act(async () => {
            await result.current.handleFilterCases({ file: null, delimiter: "," });
        });

        expect(toast.info).toHaveBeenCalledWith("massiveExecution.message.fileRequired", expect.any(Object));
        expect(mockFetchQuery).not.toHaveBeenCalled();
    });

    it("rejects files that are not CSV and shows an error toast", async () => {
        const { result } = renderHook(() => useMassiveExecutionCasesForm());
        const pdfFile = new File(["some content"], "cases.pdf", { type: "application/pdf" });

        await act(async () => {
            await result.current.handleFilterCases({
                file: [{ fileData: pdfFile, path: "cases.pdf" }],
                delimiter: ",",
            });
        });

        expect(toast.error).toHaveBeenCalledWith("massiveExecution.message.onlyCsvFiles", expect.any(Object));
        expect(mockFetchQuery).not.toHaveBeenCalled();
    });

    it("shows notFound toast when CSV file has no valid data or columns", async () => {
        const { result } = renderHook(() => useMassiveExecutionCasesForm());
        const csvFile = new File(["header_only\n"], "cases.csv", { type: "text/csv" });

        await act(async () => {
            await result.current.handleFilterCases({
                file: [{ fileData: csvFile, path: "cases.csv" }],
                delimiter: ",",
            });
        });

        expect(toast.info).toHaveBeenCalledWith("massiveExecution.message.notFound", expect.any(Object));
        expect(mockSetQueryData).toHaveBeenCalledWith(expect.any(Array), {
            data: [],
        });
        expect(mockFetchQuery).not.toHaveBeenCalled();
    });

    it("shows success confirmation toast when CSV cases are found and loaded", async () => {
        const { result } = renderHook(() => useMassiveExecutionCasesForm());
        const csvFile = new File(["1001,extra\n1002,extra\n"], "cases.csv", { type: "text/csv" });

        mockFetchQuery.mockResolvedValueOnce({
            data: [
                { id: "1", reference: 1001 },
                { id: "2", reference: 1002 },
            ],
        });

        await act(async () => {
            await result.current.handleFilterCases({
                file: [{ fileData: csvFile, path: "cases.csv", s3Path: "s3/cases.csv" }],
                delimiter: ",",
            });
        });

        expect(mockSetQueryData).toHaveBeenCalledWith(["actionJobsFilterCases", [], null], {
            data: [
                { id: "1", reference: 1001 },
                { id: "2", reference: 1002 },
            ],
        });
        expect(toast.success).toHaveBeenCalledWith("massiveExecution.message.fileLoadedSuccess", expect.any(Object));
    });

    it("shows notFound toast when search query returns empty data", async () => {
        const { result } = renderHook(() => useMassiveExecutionCasesForm());
        const csvFile = new File(["1001,extra\n"], "cases.csv", { type: "text/csv" });

        mockFetchQuery.mockResolvedValueOnce({
            data: [],
        });

        await act(async () => {
            await result.current.handleFilterCases({
                file: [{ fileData: csvFile, path: "cases.csv", s3Path: "s3/cases.csv" }],
                delimiter: ",",
            });
        });

        expect(toast.info).toHaveBeenCalledWith("massiveExecution.message.notFound", expect.any(Object));
    });

    it("preserves reference 0 when parsing CSV file", async () => {
        const { result } = renderHook(() => useMassiveExecutionCasesForm());
        const csvFile = new File(["0,action1\n"], "cases.csv", { type: "text/csv" });

        mockFetchQuery.mockResolvedValueOnce({
            data: [{ id: "case-0", reference: 0 }],
        });

        await act(async () => {
            await result.current.handleFilterCases({
                file: [{ fileData: csvFile, path: "cases.csv", s3Path: "s3/cases.csv" }],
                delimiter: ",",
            });
        });

        expect(mockFetchQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: expect.anything(),
            }),
        );
        expect(toast.success).toHaveBeenCalledWith("massiveExecution.message.fileLoadedSuccess", expect.any(Object));
    });

    it("resets executionData s3_file_key and clears cache on early exit", async () => {
        const { result } = renderHook(() => useMassiveExecutionCasesForm());
        const nonCsvFile = new File(["bad content"], "invalid.txt", { type: "text/plain" });

        await act(async () => {
            await result.current.handleFilterCases({
                file: [{ fileData: nonCsvFile, path: "invalid.txt", s3Path: "s3/invalid.txt" }],
                delimiter: ",",
            });
        });

        expect(toast.error).toHaveBeenCalledWith("massiveExecution.message.onlyCsvFiles", expect.any(Object));

        await act(async () => {
            await result.current.handleExecutionActions({ action_id: "action-123" });
        });

        expect(mockMutate).toHaveBeenCalledWith(
            expect.objectContaining({
                values: expect.objectContaining({
                    s3_file_key: "",
                }),
            }),
        );
    });

    it("shows skippedRowsWarning toast when some rows have invalid columns but valid data exists", async () => {
        const { result } = renderHook(() => useMassiveExecutionCasesForm());
        const csvFile = new File(["1001,extra\ninvalid_no_delimiter\n1002,extra\n"], "cases.csv", { type: "text/csv" });

        mockFetchQuery.mockResolvedValueOnce({
            data: [
                { id: "1", reference: 1001 },
                { id: "2", reference: 1002 },
            ],
        });

        await act(async () => {
            await result.current.handleFilterCases({
                file: [{ fileData: csvFile, path: "cases.csv", s3Path: "s3/cases.csv" }],
                delimiter: ",",
            });
        });

        expect(toast.warning).toHaveBeenCalledWith("massiveExecution.message.skippedRowsWarning", expect.any(Object));
        expect(toast.success).toHaveBeenCalledWith("massiveExecution.message.fileLoadedSuccess", expect.any(Object));
    });
});
