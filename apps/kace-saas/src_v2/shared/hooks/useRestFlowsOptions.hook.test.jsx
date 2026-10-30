import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { fetchRestFlows } from "@kace_v2/shared/services/restflows.service";
import { filterByIsPrimary } from "@/utils/genericFilters";
import useRestFlowsOptions from "@kace_v2/shared/hooks/useRestFlowsOptions.hook";

vi.mock("@kace_v2/shared/services/restflows.service", () => ({ fetchRestFlows: vi.fn() }));

const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // eslint-disable-next-line react/display-name, react/prop-types
    return ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const lastCallArgs = () => fetchRestFlows.mock.calls[fetchRestFlows.mock.calls.length - 1][0];

describe("useRestFlowsOptions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchRestFlows.mockResolvedValue({ data: [], count: 0, total: 0 });
    });

    it("filtra flujos primarios y no eliminados en la carga inicial", async () => {
        renderHook(() => useRestFlowsOptions(), { wrapper: createWrapper() });

        await waitFor(() => expect(fetchRestFlows).toHaveBeenCalled());

        expect(lastCallArgs().filter).toEqual([
            { field: "deleted_at", operator: "null", type: "AND", value: "null" },
            filterByIsPrimary,
        ]);
    });

    it("busca por description y mantiene is_primary", async () => {
        const { result } = renderHook(() => useRestFlowsOptions(), { wrapper: createWrapper() });
        await waitFor(() => expect(fetchRestFlows).toHaveBeenCalledTimes(1));

        fetchRestFlows.mockResolvedValueOnce({
            data: [{ id: "rf-1", description: "Flujo principal" }],
        });

        const options = await result.current.onSearch("principal");

        expect(lastCallArgs().filter).toContainEqual(filterByIsPrimary);
        expect(lastCallArgs().filter).toContainEqual({
            field: "description",
            operator: "ilike",
            type: "AND",
            value: "principal",
        });
        expect(options).toEqual([{ label: "Flujo principal", value: "rf-1" }]);
    });
});
