import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { fetchUsers } from "@kace_v2/shared/services/users.service";
import useUsersOptions from "@kace_v2/shared/hooks/useUsersOptions.hook";

vi.mock("@kace_v2/shared/services/users.service", () => ({ fetchUsers: vi.fn() }));

const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // eslint-disable-next-line react/display-name, react/prop-types
    return ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const lastCallArgs = () => fetchUsers.mock.calls[fetchUsers.mock.calls.length - 1][0];

/*
 * Referencia reutilizada en los tests de onSearch: no depende de la estabilidad del
 * hook (ver describe de mas abajo), simplemente evita repetir el literal.
 */
const NO_INITIAL_USERS = [];

describe("useUsersOptions.onSearch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        /*
         * useInfiniteQuery dispara un fetchUsers al montar el hook; default para que
         * ese fetch inicial no interfiera con las aserciones sobre la llamada de onSearch.
         */
        fetchUsers.mockResolvedValue({ data: [], count: 0, total: 0 });
    });

    it("siempre envia el filtro deleted_at=null", async () => {
        const { result } = renderHook(() => useUsersOptions(NO_INITIAL_USERS), { wrapper: createWrapper() });

        await result.current.onSearch("Juan");

        expect(lastCallArgs().filter).toContainEqual({
            field: "deleted_at",
            operator: "null",
            type: "AND",
            value: "null",
        });
    });

    it("busca por frase completa (ilike OR) agrupada bajo el filtro deleted_at, sin tokenizar por palabra", async () => {
        const { result } = renderHook(() => useUsersOptions(NO_INITIAL_USERS), { wrapper: createWrapper() });

        await result.current.onSearch("Juan Perez");

        const { filter } = lastCallArgs();
        expect(filter).toEqual([
            {
                field: "deleted_at",
                operator: "null",
                type: "AND",
                value: "null",
            },
            {
                groupType: "AND",
                filters: [
                    { field: "nombres", operator: "ilike", type: "OR", value: "Juan Perez" },
                    { field: "apellido1", operator: "ilike", type: "OR", value: "Juan Perez" },
                    { field: "apellido2", operator: "ilike", type: "OR", value: "Juan Perez" },
                ],
            },
        ]);
    });

    it("acota la busqueda con limit=pageSize", async () => {
        const { result } = renderHook(() => useUsersOptions(NO_INITIAL_USERS, 25), { wrapper: createWrapper() });

        await result.current.onSearch("ana");

        expect(lastCallArgs()).toMatchObject({ limit: 25, offset: 0 });
    });

    it("filtra opciones sin id y mapea el label a partir de nombres/apellidos", async () => {
        const { result } = renderHook(() => useUsersOptions(NO_INITIAL_USERS), { wrapper: createWrapper() });
        await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(1));

        fetchUsers.mockResolvedValueOnce({
            data: [
                { id: "u1", nombres: "Ana", apellido1: "Diaz", apellido2: "Rojas" },
                { id: undefined, nombres: "SinId" },
            ],
        });

        const options = await result.current.onSearch("a");

        expect(options).toEqual([{ label: "Ana Diaz Rojas", value: "u1" }]);
    });

    it("devuelve [] cuando la respuesta no trae data", async () => {
        const { result } = renderHook(() => useUsersOptions(NO_INITIAL_USERS), { wrapper: createWrapper() });
        await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(1));

        fetchUsers.mockResolvedValueOnce({});

        await expect(result.current.onSearch("x")).resolves.toEqual([]);
    });

    it("excluye usuarios eliminados tambien en la carga inicial (useInfiniteQuery)", async () => {
        renderHook(() => useUsersOptions(NO_INITIAL_USERS), { wrapper: createWrapper() });

        await waitFor(() => expect(fetchUsers).toHaveBeenCalled());

        expect(lastCallArgs().filter).toContainEqual({
            field: "deleted_at",
            operator: "null",
            type: "AND",
            value: "null",
        });
    });
});

describe("useUsersOptions - estabilidad de initialUsers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchUsers.mockResolvedValue({ data: [], count: 0, total: 0 });
    });

    it("no entra en loop de render cuando el caller pasa un array nuevo (con igual contenido) en cada llamada", () => {
        /*
         * Reproduce el patron real de BoardCasesBulkAssignFields.jsx, que invoca
         * useGroupsOptions([], ...) inline en su propio render. Antes del fix, el
         * useEffect([initialUsers]) volvia a ejecutar setUsers en cada render porque
         * [] es una referencia distinta cada vez, retroalimentando el ciclo sin fin.
         */
        const { result, rerender } = renderHook(({ initialUsers }) => useUsersOptions(initialUsers), {
            wrapper: createWrapper(),
            initialProps: { initialUsers: ["u1"] },
        });

        expect(result.current.users).toEqual(["u1"]);

        const firstRef = result.current.users;

        rerender({ initialUsers: ["u1"] });

        expect(result.current.users).toEqual(["u1"]);
        expect(result.current.users).toBe(firstRef);
    });

    it("actualiza users cuando initialUsers cambia de contenido", () => {
        const { result, rerender } = renderHook(({ initialUsers }) => useUsersOptions(initialUsers), {
            wrapper: createWrapper(),
            initialProps: { initialUsers: ["u1"] },
        });

        expect(result.current.users).toEqual(["u1"]);

        rerender({ initialUsers: ["u1", "u2"] });

        expect(result.current.users).toEqual(["u1", "u2"]);
    });
});
