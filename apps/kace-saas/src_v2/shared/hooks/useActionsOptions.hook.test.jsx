import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { fetchActions } from "@kace_v2/shared/services/actions.service";
import { filterByIsPrimary } from "@/utils/genericFilters";
import useActionsOptions from "@kace_v2/shared/hooks/useActionsOptions.hook";

vi.mock("@kace_v2/shared/services/actions.service", () => ({ fetchActions: vi.fn() }));

const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // eslint-disable-next-line react/display-name, react/prop-types
    return ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const lastCallArgs = () => fetchActions.mock.calls[fetchActions.mock.calls.length - 1][0];

describe("useActionsOptions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchActions.mockResolvedValue({ data: [], count: 0, total: 0 });
    });

    it("no aplica is_primary y busca por description", async () => {
        const { result } = renderHook(() => useActionsOptions(), { wrapper: createWrapper() });
        await waitFor(() => expect(fetchActions).toHaveBeenCalledTimes(1));

        expect(lastCallArgs().filter).toEqual([{ field: "deleted_at", operator: "null", type: "AND", value: "null" }]);
        expect(lastCallArgs().filter).not.toContainEqual(filterByIsPrimary);

        fetchActions.mockResolvedValueOnce({
            data: [{ id: "act-1", description: "Cerrar caso" }],
        });

        const options = await result.current.onSearch("Cerrar");
        expect(lastCallArgs().filter).toContainEqual({
            field: "description",
            operator: "ilike",
            type: "AND",
            value: "Cerrar",
        });
        expect(options).toEqual([{ label: "Cerrar caso", value: "act-1" }]);
    });
});
