import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
import { genericSearchService } from "@/services/genericSearchService";
import useGenericSearchInfiniteQuery from "./useGenericSearchInfiniteQuery";
import useAuxiliariesOptions from "./useAuxiliariesOptions";
import useOptionsList from "./useOptionsList";

vi.mock("@tanstack/react-query", () => ({
    useQuery: vi.fn(),
}));

vi.mock("@/services/genericSearchService", () => ({
    genericSearchService: vi.fn(),
}));

vi.mock("./useAuxiliariesOptions", () => ({
    default: vi.fn(() => ({
        auxiliariesRules: [],
        loading: false,
    })),
}));

vi.mock("./useGenericSearchInfiniteQuery", () => ({
    default: vi.fn(),
}));

const infiniteOptionsResult = {
    data: { pages: [] },
    isLoading: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
};

describe("useOptionsList", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks no revierte implementaciones: cada bloque fija la suya.
        useAuxiliariesOptions.mockImplementation(() => ({ auxiliariesRules: [], loading: false }));
        useQuery.mockReturnValue({ data: null });
        useGenericSearchInfiniteQuery.mockReturnValue(infiniteOptionsResult);
        genericSearchService.mockResolvedValue({ data: [], total: 0 });
    });

    it("forwards default-filter settings to text searches", async () => {
        const order = { field: "grupo_id", direction: "asc" };
        const filter = [{ field: "usuario_id", operator: "eq", value: "user-1", type: "AND" }];

        const { result } = renderHook(() =>
            useOptionsList({
                url: "user-group-relationships/search",
                queryKey: ["userRelated-groups", "user-1"],
                valueField: "grupo_id",
                labelField: "nombre",
                filter,
                useDefault: false,
                order,
            }),
        );

        await result.current.onSearch("Admin");

        expect(useGenericSearchInfiniteQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                filter,
                order,
                useDefault: false,
            }),
        );
        expect(genericSearchService).toHaveBeenCalledWith(
            "user-group-relationships/search",
            [...filter, { field: "nombre", operator: "ilike", value: "Admin", type: "AND" }],
            { limit: 50, offset: 0 },
            null,
            false,
            null,
            order,
        );
    });

    it("forwards default-filter settings to the selected item lookup", async () => {
        const order = { field: "grupo_id", direction: "asc" };
        const filter = [{ field: "usuario_id", operator: "eq", value: "user-1", type: "AND" }];

        renderHook(() =>
            useOptionsList({
                url: "user-group-relationships/search",
                queryKey: ["userRelated-groups", "user-1"],
                valueField: "grupo_id",
                labelField: "nombre",
                filter,
                initialId: "group-1",
                useDefault: false,
                order,
            }),
        );

        await useQuery.mock.calls.at(-1)[0].queryFn();

        expect(genericSearchService).toHaveBeenCalledWith(
            "user-group-relationships/search",
            [...filter, { field: "grupo_id", operator: "eq", value: "group-1", type: "AND" }],
            { limit: 1, offset: 0 },
            null,
            false,
            null,
            order,
        );
    });

    it("issues one AND-only search per entry in searchFields and merges the results", async () => {
        genericSearchService
            .mockResolvedValueOnce({ data: [{ id: "u1", nombres: "Ana", apellido1: "Pérez", apellido2: "Gómez" }] })
            .mockResolvedValueOnce({ data: [{ id: "u1", nombres: "Ana", apellido1: "Pérez", apellido2: "Gómez" }] })
            .mockResolvedValueOnce({ data: [{ id: "u2", nombres: "Luis", apellido1: "Pérez", apellido2: "Ruiz" }] });

        const formatLabel = (u) => [u.nombres, u.apellido1, u.apellido2].filter(Boolean).join(" ");

        const { result } = renderHook(() =>
            useOptionsList({
                url: "users/search",
                queryKey: ["builder_users"],
                valueField: "id",
                labelField: "nombres",
                formatLabel,
                searchFields: ["nombres", "apellido1", "apellido2"],
                pageSize: 20,
            }),
        );

        const options = await result.current.onSearch("perez");

        expect(genericSearchService).toHaveBeenCalledTimes(3);
        const searchedFields = genericSearchService.mock.calls.map(([, filter]) => filter.at(-1).field).sort();
        expect(searchedFields).toEqual(["apellido1", "apellido2", "nombres"]);
        expect(options).toEqual([
            { value: "u1", label: "Ana Pérez Gómez" },
            { value: "u2", label: "Luis Pérez Ruiz" },
        ]);
    });
});

describe("useOptionsList - auxiliary-backed lists (no url)", () => {
    const auxOptions = [
        { value: "cliente.codigo_externo", label: "cliente.codigo_externo", id: "s1_cliente.codigo_externo" },
        { value: "empresa.codigo", label: "empresa.codigo", id: "s1_empresa.codigo" },
        { value: "cliente.días_mora", label: "cliente.días_mora", id: "s1_cliente.días_mora" },
        { value: "nivel1", label: "nivel1", id: "s1_nivel1" },
    ];

    /*
     * El hook lee las opciones del auxiliar en cada render; los tests de rerender
     * mutan esta variable para simular que la lista llega o cambia entre renders.
     */
    let currentAuxOptions = auxOptions;

    /*
     * `filter` debe ser referencialmente estable: el default `[]` del hook crea un
     * array nuevo por render y recrearía `onSearch` por sí solo, tapando lo que
     * estos tests miden.
     */
    const stableFilter = [];

    const renderAuxHook = () =>
        renderHook(() =>
            useOptionsList({
                url: null,
                queryKey: ["actionsOptions"],
                valueField: "id",
                labelField: "descripcion",
                auxiliary: "aux_cases",
                filter: stableFilter,
            }),
        );

    beforeEach(() => {
        vi.clearAllMocks();
        currentAuxOptions = auxOptions;
        useQuery.mockReturnValue({ data: null });
        useGenericSearchInfiniteQuery.mockReturnValue(infiniteOptionsResult);
        genericSearchService.mockResolvedValue({ data: [], total: 0 });
        useAuxiliariesOptions.mockImplementation(() => ({
            auxiliariesRules: [{ dataOrigin: "aux_cases", options: currentAuxOptions }],
            loading: false,
        }));
    });

    it("exposes the auxiliary options as the base list", () => {
        const { result } = renderAuxHook();

        expect(result.current.options).toEqual(auxOptions);
    });

    it("filters the auxiliary options locally instead of hitting the backend", async () => {
        const { result } = renderAuxHook();

        await expect(result.current.onSearch("codigo")).resolves.toEqual([auxOptions[0], auxOptions[1]]);
        await expect(result.current.onSearch("empresa")).resolves.toEqual([auxOptions[1]]);

        expect(genericSearchService).not.toHaveBeenCalled();
    });

    it("ignores case and accents when matching", async () => {
        const { result } = renderAuxHook();

        await expect(result.current.onSearch("CÓDIGO")).resolves.toEqual([auxOptions[0], auxOptions[1]]);
        await expect(result.current.onSearch("dias")).resolves.toEqual([auxOptions[2]]);

        expect(genericSearchService).not.toHaveBeenCalled();
    });

    it("returns an empty list when nothing matches", async () => {
        const { result } = renderAuxHook();

        await expect(result.current.onSearch("zzzz")).resolves.toEqual([]);
        expect(genericSearchService).not.toHaveBeenCalled();
    });

    it("returns every option for a blank search", async () => {
        const { result } = renderAuxHook();

        await expect(result.current.onSearch("")).resolves.toEqual(auxOptions);
        await expect(result.current.onSearch("   ")).resolves.toEqual(auxOptions);
        expect(genericSearchService).not.toHaveBeenCalled();
    });

    it("treats null/undefined search as a blank query", async () => {
        const { result } = renderAuxHook();

        await expect(result.current.onSearch(null)).resolves.toEqual(auxOptions);
        await expect(result.current.onSearch(undefined)).resolves.toEqual(auxOptions);
        expect(genericSearchService).not.toHaveBeenCalled();
    });

    it("keeps the same onSearch reference when the options change between renders", () => {
        const { result, rerender } = renderAuxHook();

        const firstOnSearch = result.current.onSearch;

        currentAuxOptions = [...auxOptions, { value: "nivel2", label: "nivel2", id: "s1_nivel2" }];
        rerender();

        expect(result.current.options).toHaveLength(auxOptions.length + 1);
        expect(result.current.onSearch).toBe(firstOnSearch);
    });

    it("searches over the latest options even from an onSearch captured earlier", async () => {
        const { result, rerender } = renderAuxHook();

        const staleOnSearch = result.current.onSearch;

        currentAuxOptions = [{ value: "sucursal.código", label: "sucursal.código", id: "s1_sucursal.código" }];
        rerender();

        await expect(staleOnSearch("SUCURSAL")).resolves.toEqual(currentAuxOptions);
        await expect(staleOnSearch("empresa")).resolves.toEqual([]);
        expect(genericSearchService).not.toHaveBeenCalled();
    });
});
