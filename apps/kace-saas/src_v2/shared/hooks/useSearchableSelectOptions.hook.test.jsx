import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import useSearchableSelectOptions from "@kace_v2/shared/hooks/useSearchableSelectOptions.hook";

const fetchFn = vi.fn();

const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // eslint-disable-next-line react/display-name, react/prop-types
    return ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const extraFilters = [{ field: "is_primary", operator: "eq", value: "true", type: "AND" }];

const renderOptionsHook = (overrides = {}) =>
    renderHook(
        () =>
            useSearchableSelectOptions({
                queryKey: ["test-select-options"],
                fetchFn,
                mapItem: (item) => ({ label: item.description, value: item.id }),
                extraFilters,
                searchField: "description",
                pageSize: 50,
                order: { direction: "asc", field: "description" },
                ...overrides,
            }),
        { wrapper: createWrapper() },
    );

const lastCallArgs = () => fetchFn.mock.calls[fetchFn.mock.calls.length - 1][0];

describe("useSearchableSelectOptions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchFn.mockResolvedValue({ data: [], count: 0, total: 0 });
    });

    it("carga inicial con deleted_at null, extraFilters, orden y primera pagina", async () => {
        renderOptionsHook();

        await waitFor(() => expect(fetchFn).toHaveBeenCalled());

        expect(lastCallArgs()).toEqual({
            filter: [
                { field: "deleted_at", operator: "null", type: "AND", value: "null" },
                { field: "is_primary", operator: "eq", value: "true", type: "AND" },
            ],
            limit: 50,
            offset: 0,
            order: { direction: "asc", field: "description" },
        });
    });

    it("mapea items de las paginas y descarta los que no tienen id", async () => {
        fetchFn.mockResolvedValueOnce({
            data: [
                { id: "a1", description: "Alfa" },
                { id: undefined, description: "Sin id" },
            ],
            count: 2,
            total: 2,
        });

        const { result } = renderOptionsHook();

        await waitFor(() => expect(result.current.options).toEqual([{ label: "Alfa", value: "a1" }]));
    });

    it("onSearch reenvia extraFilters y busca ilike por searchField con limit=pageSize", async () => {
        const { result } = renderOptionsHook();
        await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

        fetchFn.mockResolvedValueOnce({
            data: [{ id: "a2", description: "Beta flow" }],
            count: 1,
            total: 1,
        });

        const options = await result.current.onSearch("Beta");

        expect(lastCallArgs()).toEqual({
            filter: [
                { field: "deleted_at", operator: "null", type: "AND", value: "null" },
                { field: "is_primary", operator: "eq", value: "true", type: "AND" },
                { field: "description", operator: "ilike", type: "AND", value: "Beta" },
            ],
            limit: 50,
            offset: 0,
            order: { direction: "asc", field: "description" },
        });
        expect(options).toEqual([{ label: "Beta flow", value: "a2" }]);
    });

    it("onSearch devuelve [] cuando la respuesta no trae data", async () => {
        const { result } = renderOptionsHook();
        await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

        fetchFn.mockResolvedValueOnce({});

        await expect(result.current.onSearch("x")).resolves.toEqual([]);
    });

    it("hasNextPage cuando total es el objeto knex { count } de actions y onescript", async () => {
        fetchFn.mockResolvedValue({
            data: Array.from({ length: 50 }, (_, index) => ({
                id: `a${index}`,
                description: `Item ${index}`,
            })),
            count: 50,
            total: { count: 80 },
        });

        const { result } = renderOptionsHook();

        await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    });

    it("ensure envia id in como CSV deduplicado y sin extraFilters", async () => {
        renderOptionsHook({ initialIds: ["a", "b", "a"] });

        await waitFor(() => expect(fetchFn).toHaveBeenCalled());

        const ensureCall = fetchFn.mock.calls
            .map((call) => call[0])
            .find((args) => (args.filter || []).some((filter) => filter.field === "id"));

        expect(ensureCall).toEqual({
            filter: [
                { field: "deleted_at", operator: "null", type: "AND", value: "null" },
                { field: "id", operator: "in", type: "AND", value: "a,b" },
            ],
            limit: 2,
            offset: 0,
            order: { direction: "asc", field: "description" },
        });
    });

    it("mezcla el id asegurado en options cuando no esta en la primera pagina", async () => {
        fetchFn.mockImplementation((criteria) => {
            const hasIdFilter = (criteria.filter || []).some((f) => f.field === "id");
            if (hasIdFilter) {
                return Promise.resolve({
                    data: [{ id: "kept", description: "Fuera de pagina" }],
                    count: 1,
                    total: 1,
                });
            }
            return Promise.resolve({
                data: [{ id: "page-1", description: "Primera" }],
                count: 1,
                total: 80,
            });
        });

        const { result } = renderOptionsHook({ initialIds: ["kept"] });

        await waitFor(() =>
            expect(result.current.options).toEqual([
                { label: "Fuera de pagina", value: "kept" },
                { label: "Primera", value: "page-1" },
            ]),
        );
    });

    it("cuando fetchNextPage trae el id asegurado queda una sola vez en la pagina", async () => {
        fetchFn.mockImplementation((criteria) => {
            const hasIdFilter = (criteria.filter || []).some((f) => f.field === "id");
            if (hasIdFilter) {
                return Promise.resolve({
                    data: [{ id: "kept", description: "Fuera de pagina" }],
                    count: 1,
                    total: 1,
                });
            }
            if (criteria.offset === 0) {
                return Promise.resolve({
                    data: [{ id: "page-1", description: "Primera" }],
                    count: 1,
                    total: 80,
                });
            }
            return Promise.resolve({
                data: [
                    { id: "kept", description: "Fuera de pagina" },
                    { id: "page-2", description: "Siguiente" },
                ],
                count: 2,
                total: 80,
            });
        });

        const { result } = renderOptionsHook({ initialIds: ["kept"], pageSize: 1 });

        await waitFor(() =>
            expect(result.current.options).toEqual([
                { label: "Fuera de pagina", value: "kept" },
                { label: "Primera", value: "page-1" },
            ]),
        );

        await result.current.fetchNextPage();

        await waitFor(() =>
            expect(result.current.options).toEqual([
                { label: "Primera", value: "page-1" },
                { label: "Fuera de pagina", value: "kept" },
                { label: "Siguiente", value: "page-2" },
            ]),
        );
        expect(result.current.options.filter((option) => option.value === "kept")).toHaveLength(1);
    });
});
