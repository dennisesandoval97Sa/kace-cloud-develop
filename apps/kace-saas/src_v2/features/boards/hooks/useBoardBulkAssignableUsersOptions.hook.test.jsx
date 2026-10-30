import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { fetchUsers } from "@kace_v2/shared/services/users.service";
import useBoardBulkAssignableUsersOptions from "./useBoardBulkAssignableUsersOptions.hook";

vi.mock("@kace_v2/shared/services/users.service", () => ({ fetchUsers: vi.fn() }));

const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // eslint-disable-next-line react/display-name, react/prop-types
    return ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const lastCallArgs = () => fetchUsers.mock.calls[fetchUsers.mock.calls.length - 1][0];

describe("useBoardBulkAssignableUsersOptions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchUsers.mockResolvedValue({ data: [], count: 0, total: 0 });
    });

    it("envia los filtros is_active=1 y deleted_at=null en la carga inicial", async () => {
        renderHook(() => useBoardBulkAssignableUsersOptions({ enabled: true }), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(fetchUsers).toHaveBeenCalled());

        expect(lastCallArgs().filter).toContainEqual({
            field: "deleted_at",
            operator: "null",
            type: "AND",
            value: "null",
        });
        expect(lastCallArgs().filter).toContainEqual({
            field: "is_active",
            operator: "eq",
            type: "AND",
            value: "1",
        });
    });

    it("envia los filtros is_active=1 y deleted_at=null en onSearch", async () => {
        const { result } = renderHook(() => useBoardBulkAssignableUsersOptions({ enabled: true }), {
            wrapper: createWrapper(),
        });

        await result.current.onSearch("Juan");

        expect(lastCallArgs().filter).toContainEqual({
            field: "deleted_at",
            operator: "null",
            type: "AND",
            value: "null",
        });
        expect(lastCallArgs().filter).toContainEqual({
            field: "is_active",
            operator: "eq",
            type: "AND",
            value: "1",
        });
    });
});
