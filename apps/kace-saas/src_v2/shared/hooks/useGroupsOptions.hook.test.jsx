import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { fetchGroups } from "@kace_v2/shared/services/groups.service";
import useGroupsOptions from "@kace_v2/shared/hooks/useGroupsOptions.hook";

vi.mock("@kace_v2/shared/services/groups.service", () => ({ fetchGroups: vi.fn() }));

const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // eslint-disable-next-line react/display-name, react/prop-types
    return ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const lastCallArgs = () => fetchGroups.mock.calls[fetchGroups.mock.calls.length - 1][0];

const NO_INITIAL_GROUPS = [];

describe("useGroupsOptions.onSearch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchGroups.mockResolvedValue({ data: [], count: 0, total: 0 });
    });

    it("siempre envia el filtro deleted_at=null y status=1", async () => {
        const { result } = renderHook(() => useGroupsOptions(NO_INITIAL_GROUPS), { wrapper: createWrapper() });

        await result.current.onSearch("Soporte");

        expect(lastCallArgs().filter).toContainEqual({
            field: "deleted_at",
            operator: "null",
            type: "AND",
            value: "null",
        });
        expect(lastCallArgs().filter).toContainEqual({
            field: "status",
            operator: "eq",
            type: "AND",
            value: 1,
        });
    });

    it("acota la busqueda con limit=pageSize", async () => {
        const { result } = renderHook(() => useGroupsOptions(NO_INITIAL_GROUPS, 25), { wrapper: createWrapper() });

        await result.current.onSearch("soporte");

        expect(lastCallArgs()).toMatchObject({ limit: 25, offset: 0 });
    });

    it("filtra opciones sin id y mapea el label a partir de nombre", async () => {
        const { result } = renderHook(() => useGroupsOptions(NO_INITIAL_GROUPS), { wrapper: createWrapper() });
        await waitFor(() => expect(fetchGroups).toHaveBeenCalledTimes(1));

        fetchGroups.mockResolvedValueOnce({
            data: [
                { id: "g1", nombre: "Soporte" },
                { id: undefined, nombre: "SinId" },
            ],
        });

        const options = await result.current.onSearch("s");

        expect(options).toEqual([{ label: "Soporte", value: "g1" }]);
    });

    it("devuelve [] cuando la respuesta no trae data", async () => {
        const { result } = renderHook(() => useGroupsOptions(NO_INITIAL_GROUPS), { wrapper: createWrapper() });
        await waitFor(() => expect(fetchGroups).toHaveBeenCalledTimes(1));

        fetchGroups.mockResolvedValueOnce({});

        await expect(result.current.onSearch("x")).resolves.toEqual([]);
    });

    it("excluye grupos eliminados e inactivos tambien en la carga inicial (useInfiniteQuery)", async () => {
        renderHook(() => useGroupsOptions(NO_INITIAL_GROUPS), { wrapper: createWrapper() });

        await waitFor(() => expect(fetchGroups).toHaveBeenCalled());

        expect(lastCallArgs().filter).toContainEqual({
            field: "deleted_at",
            operator: "null",
            type: "AND",
            value: "null",
        });
        expect(lastCallArgs().filter).toContainEqual({
            field: "status",
            operator: "eq",
            type: "AND",
            value: 1,
        });
    });

    it("respeta enabled=false y no dispara la carga inicial", () => {
        renderHook(() => useGroupsOptions(NO_INITIAL_GROUPS, 100, { enabled: false }), {
            wrapper: createWrapper(),
        });

        expect(fetchGroups).not.toHaveBeenCalled();
    });
});

describe("useGroupsOptions - estabilidad de initialGroups", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchGroups.mockResolvedValue({ data: [], count: 0, total: 0 });
    });

    it("no entra en loop de render cuando el caller pasa un array nuevo (con igual contenido) en cada llamada", () => {
        /*
         * Reproduce BoardCasesBulkAssignFields.jsx:34, que llama
         * useGroupsOptions([], 100, { enabled }) inline en su propio render.
         */
        const { result, rerender } = renderHook(({ initialGroups }) => useGroupsOptions(initialGroups), {
            wrapper: createWrapper(),
            initialProps: { initialGroups: ["g1"] },
        });

        expect(result.current.groups).toEqual(["g1"]);

        const firstRef = result.current.groups;

        rerender({ initialGroups: ["g1"] });

        expect(result.current.groups).toEqual(["g1"]);
        expect(result.current.groups).toBe(firstRef);
    });

    it("actualiza groups cuando initialGroups cambia de contenido", () => {
        const { result, rerender } = renderHook(({ initialGroups }) => useGroupsOptions(initialGroups), {
            wrapper: createWrapper(),
            initialProps: { initialGroups: ["g1"] },
        });

        expect(result.current.groups).toEqual(["g1"]);

        rerender({ initialGroups: ["g1", "g2"] });

        expect(result.current.groups).toEqual(["g1", "g2"]);
    });
});
