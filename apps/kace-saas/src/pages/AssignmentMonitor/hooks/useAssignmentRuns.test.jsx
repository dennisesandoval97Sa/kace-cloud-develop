import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import useAssignmentRuns from "./useAssignmentRuns";

const mockGenericSearchService = vi.fn();

vi.mock("../../../services/genericSearchService", () => ({
    genericSearchService: (...args) => mockGenericSearchService(...args),
}));

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    const Wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    return Wrapper;
};

const renderUseAssignmentRuns = () => renderHook(() => useAssignmentRuns(), { wrapper: createWrapper() });

describe("useAssignmentRuns", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenericSearchService.mockResolvedValue({ data: [], count: 0, total: 0 });
    });

    it("builds gte/lte/eq filters from dateFrom/dateTo/status and passes limit/offset", async () => {
        const { result } = renderUseAssignmentRuns();

        act(() => {
            result.current.setDateFrom("2026-07-20T08:15");
            result.current.setDateTo("2026-07-21T17:45");
            result.current.setStatus("error");
        });

        await waitFor(() => {
            const lastCall = mockGenericSearchService.mock.calls.at(-1);
            expect(lastCall[0]).toBe("/assignment-runs/search");
            expect(lastCall[1]).toEqual([
                {
                    field: "automated_assignment_runs.started_at",
                    operator: "gte",
                    value: new Date("2026-07-20T08:15").toISOString(),
                    type: "AND",
                },
                {
                    field: "automated_assignment_runs.started_at",
                    operator: "lte",
                    value: new Date("2026-07-21T17:45:59.999").toISOString(),
                    type: "AND",
                },
                {
                    field: "automated_assignment_runs.status",
                    operator: "eq",
                    value: "error",
                    type: "AND",
                },
            ]);
            expect(lastCall[2]).toEqual({ limit: 10, offset: 0 });
            expect(lastCall[3]).toBe("automated_assignment_runs");
        });
    });

    it("converts the from date-time to ISO using the local timezone (start of the chosen minute)", async () => {
        const { result } = renderUseAssignmentRuns();

        act(() => {
            result.current.setDateFrom("2026-07-20T08:15");
        });

        await waitFor(() => {
            const lastCall = mockGenericSearchService.mock.calls.at(-1);
            const gteFilter = lastCall[1].find((f) => f.operator === "gte");
            expect(gteFilter.value).toBe(new Date("2026-07-20T08:15").toISOString());
        });
    });

    it("makes the to date-time inclusive to the end of the chosen minute", async () => {
        const { result } = renderUseAssignmentRuns();

        act(() => {
            result.current.setDateTo("2026-07-21T17:45");
        });

        await waitFor(() => {
            const lastCall = mockGenericSearchService.mock.calls.at(-1);
            const lteFilter = lastCall[1].find((f) => f.operator === "lte");
            expect(lteFilter.value).toBe(new Date("2026-07-21T17:45:59.999").toISOString());
        });
    });

    it("changes the page size, forwards it as the limit and resets to the first page", async () => {
        const { result } = renderUseAssignmentRuns();

        act(() => {
            result.current.setPage(2);
        });
        expect(result.current.page).toBe(2);

        act(() => {
            result.current.setPageSize(50);
        });
        expect(result.current.page).toBe(0);
        expect(result.current.pageSize).toBe(50);

        await waitFor(() => {
            const lastCall = mockGenericSearchService.mock.calls.at(-1);
            expect(lastCall[2]).toEqual({ limit: 50, offset: 0 });
        });
    });

    it("passes the page offset and resets page to 0 when a filter changes", async () => {
        const { result } = renderUseAssignmentRuns();

        act(() => {
            result.current.setPage(2);
        });
        expect(result.current.page).toBe(2);

        await waitFor(() => {
            const lastCall = mockGenericSearchService.mock.calls.at(-1);
            expect(lastCall[2]).toEqual({ limit: 10, offset: 20 });
        });

        act(() => {
            result.current.setStatus("completed");
        });
        expect(result.current.page).toBe(0);

        act(() => {
            result.current.setPage(3);
        });
        act(() => {
            result.current.setDateFrom("2026-07-20T08:15");
        });
        expect(result.current.page).toBe(0);

        act(() => {
            result.current.setPage(1);
        });
        act(() => {
            result.current.setDateTo("2026-07-21T17:45");
        });
        expect(result.current.page).toBe(0);
    });

    it("returns runs and the metadata total as count from the service response", async () => {
        mockGenericSearchService.mockResolvedValue({
            data: [{ id: "r1" }, { id: "r2" }],
            count: 2,
            total: 42,
        });
        const { result } = renderUseAssignmentRuns();

        await waitFor(() => {
            expect(result.current.runs).toEqual([{ id: "r1" }, { id: "r2" }]);
            expect(result.current.count).toBe(42);
        });
    });
});
