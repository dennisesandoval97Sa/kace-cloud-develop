import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { toast } from "sonner";
import useMassiveExecutionClientsFileForm from "./useMassiveExecutionClientsFileForm";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
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

describe("useMassiveExecutionClientsFileForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("displays an info toast when submitting without a file", async () => {
        const { result } = renderHook(() => useMassiveExecutionClientsFileForm());

        await act(async () => {
            await result.current.handleFilterClients({ file: null, delimiter: "," });
        });

        expect(toast.info).toHaveBeenCalledWith("massiveExecution.message.fileRequired", expect.any(Object));
        expect(mockFetchQuery).not.toHaveBeenCalled();
    });

    it("rejects files that are not CSV and shows an error toast", async () => {
        const { result } = renderHook(() => useMassiveExecutionClientsFileForm());
        const txtFile = new File(["some content"], "clients.txt", { type: "text/plain" });

        await act(async () => {
            await result.current.handleFilterClients({
                file: [{ fileData: txtFile, path: "clients.txt" }],
                delimiter: ",",
            });
        });

        expect(toast.error).toHaveBeenCalledWith("massiveExecution.message.onlyCsvFiles", expect.any(Object));
        expect(mockFetchQuery).not.toHaveBeenCalled();
    });

    it("shows success confirmation toast when CSV clients are found and matched", async () => {
        const { result } = renderHook(() => useMassiveExecutionClientsFileForm());
        const csvContent = "CC,123456,Extra\nTI,789012,Extra\n";
        const csvFile = new File([csvContent], "clients.csv", { type: "text/csv" });

        mockFetchQuery.mockResolvedValueOnce({
            data: [
                { id: "c1", tipo_documento: "CC", documento: "123456" },
                { id: "c2", tipo_documento: "TI", documento: "789012" },
            ],
        });

        await act(async () => {
            await result.current.handleFilterClients({
                file: [{ fileData: csvFile, path: "clients.csv", s3Path: "s3/clients.csv" }],
                delimiter: ",",
            });
        });

        expect(mockSetQueryData).toHaveBeenCalledWith(["actionJobsFilterClients", [], null], {
            data: [
                { id: "c1", tipo_documento: "CC", documento: "123456" },
                { id: "c2", tipo_documento: "TI", documento: "789012" },
            ],
        });
        expect(toast.success).toHaveBeenCalledWith("massiveExecution.message.fileLoadedSuccess", expect.any(Object));
    });

    it("shows notFound toast when no clients match the search query", async () => {
        const { result } = renderHook(() => useMassiveExecutionClientsFileForm());
        const csvContent = "CC,123456,Extra\n";
        const csvFile = new File([csvContent], "clients.csv", { type: "text/csv" });

        mockFetchQuery.mockResolvedValueOnce({
            data: [],
        });

        await act(async () => {
            await result.current.handleFilterClients({
                file: [{ fileData: csvFile, path: "clients.csv", s3Path: "s3/clients.csv" }],
                delimiter: ",",
            });
        });

        expect(toast.info).toHaveBeenCalledWith("massiveExecution.message.notFound", expect.any(Object));
        expect(mockSetQueryData).toHaveBeenCalledWith(["actionJobsFilterClients", [], null], {
            data: [],
        });

        await act(async () => {
            await result.current.handleExecutionActions();
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
        const { result } = renderHook(() => useMassiveExecutionClientsFileForm());
        const csvFile = new File(["CC,123456,Extra\ninvalid_row\nTI,789012,Extra\n"], "clients.csv", {
            type: "text/csv",
        });

        mockFetchQuery.mockResolvedValueOnce({
            data: [
                { id: "c1", tipo_documento: "CC", documento: "123456" },
                { id: "c2", tipo_documento: "TI", documento: "789012" },
            ],
        });

        await act(async () => {
            await result.current.handleFilterClients({
                file: [{ fileData: csvFile, path: "clients.csv", s3Path: "s3/clients.csv" }],
                delimiter: ",",
            });
        });

        expect(toast.warning).toHaveBeenCalledWith("massiveExecution.message.skippedRowsWarning", expect.any(Object));
        expect(toast.success).toHaveBeenCalledWith("massiveExecution.message.fileLoadedSuccess", expect.any(Object));
    });

    it("shows notFound toast and clears client filter when CSV file has no valid data or columns", async () => {
        const { result } = renderHook(() => useMassiveExecutionClientsFileForm());
        const csvFile = new File(["header_only\n"], "clients.csv", { type: "text/csv" });

        await act(async () => {
            await result.current.handleFilterClients({
                file: [{ fileData: csvFile, path: "clients.csv" }],
                delimiter: ",",
            });
        });

        expect(toast.info).toHaveBeenCalledWith("massiveExecution.message.notFound", expect.any(Object));
        expect(mockSetQueryData).toHaveBeenCalledWith(expect.any(Array), {
            data: [],
        });
        expect(mockFetchQuery).not.toHaveBeenCalled();
    });
});
