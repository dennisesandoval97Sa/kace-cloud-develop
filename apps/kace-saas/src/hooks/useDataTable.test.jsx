import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const locationMock = { state: null };

vi.mock("react-router-dom", () => ({
    useLocation: () => locationMock,
}));

/*
 * Todos los mocks devuelven referencias estables: en la app real estos valores
 * vienen de la cache de react-query y no cambian de identidad en cada render,
 * y un objeto nuevo por render provoca un bucle de efectos.
 */
const userInformation = { user: { id: "u1", filters: {} }, active_group_id: "g1" };

vi.mock("@/hooks/useUserInformation", () => ({ default: () => userInformation }));

vi.mock("@/hooks/useSchemaFields", () => {
    const emptySchema = [];
    const schemaFields = { getSchemaField: () => emptySchema };
    return { default: () => schemaFields };
});

vi.mock("@/hooks/useDataTableColumns", () => {
    const columnsResult = { columns: [], processedColumns: [] };
    return { useDataTableColumns: () => columnsResult };
});

vi.mock("@/hooks/useFilterTableHandler", () => {
    const handler = { promptConfirmation: vi.fn(), createNewFilter: vi.fn() };
    return { useFilterTableHandler: () => handler };
});

const { getSchemaFilterMock } = vi.hoisted(() => ({ getSchemaFilterMock: vi.fn(() => []) }));

vi.mock("@/services/createSchemaFilter", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, getSchemaFilter: getSchemaFilterMock, SPECIAL_FIELDS: {} };
});

const searchResult = { data: [], total: { count: 0 } };

vi.mock("@/services/genericSearchService", () => ({
    genericSearchService: vi.fn(async () => searchResult),
}));

const { readPersisted, writePersisted } = await import("@kace_v2/shared/utils/persistentStorage.util");
const { default: useDataTable } = await import("./useDataTable");

const SCOPE = { userId: "u1", groupId: "g1" };
// El namespace lleva `key` y `view`: dos tablas con la misma key no se pisan.
const NAMESPACE = "datatable:users:users";
// Sin `persist`: la persistencia esta activada por defecto.
const CONFIG = { key: "users", url: "/users", view: "users", entity: "users" };

const FILTER_VALUES = { name: { field: "users.name", operator: "ilike", type: "AND", value: "ana" } };

let queryClient;

/*
 * El cliente debe crearse una vez por test, nunca dentro del render del wrapper:
 * un cliente nuevo por render cambia el valor del provider y provoca un bucle.
 */
const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

const renderDataTable = (config = CONFIG) => renderHook(() => useDataTable({ dataTableConfig: config }), { wrapper });

beforeEach(() => {
    locationMock.state = null;
    userInformation.user = { id: "u1", filters: {} };
    userInformation.active_group_id = "g1";
    searchResult.data = [];
    searchResult.total = { count: 0 };
    getSchemaFilterMock.mockClear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});

describe("useDataTable — persistencia de estado", () => {
    it("persiste por defecto, sin declarar `persist` en la config", async () => {
        const { result } = renderDataTable();

        act(() => result.current.filters.onApply(FILTER_VALUES, 25));

        await waitFor(() => expect(readPersisted(NAMESPACE, SCOPE)?.currentFiltersValues).toEqual(FILTER_VALUES));
    });

    it("restaura filtros, orden, pageSize y columnas ocultas", async () => {
        searchResult.total = { count: 500 };
        writePersisted(
            NAMESPACE,
            {
                pageIndex: 2,
                pageSize: 50,
                sortConfig: { field: "users.name", direction: "desc" },
                currentFiltersValues: FILTER_VALUES,
                selectedFilter: "",
                columnVisibility: { email: false },
            },
            SCOPE,
        );

        const { result } = renderDataTable();

        expect(result.current.pagination.page).toBe(3);
        expect(result.current.pagination.pageSize).toBe(50);
        expect(result.current.sort.sortConfig).toEqual({ field: "users.name", direction: "desc" });
        expect(result.current.filters.currentFiltersValues).toEqual(FILTER_VALUES);
    });

    it("restaura como aplicado solo lo que estaba en appliedFilters", async () => {
        writePersisted(
            NAMESPACE,
            { currentFiltersValues: FILTER_VALUES, appliedFilters: Object.values(FILTER_VALUES) },
            SCOPE,
        );

        const { result } = renderDataTable();

        expect(result.current.filters.isActive).toBe(true);
        expect(result.current.filters.currentFiltersValues).toEqual(FILTER_VALUES);
    });

    /*
     * onFilterSelect prellena el modal sin ejecutar el filtro. Derivar userFilters
     * de currentFiltersValues convertia ese preset en aplicado tras recargar.
     */
    it("un preset solo prellenado no se convierte en filtro aplicado al restaurar", async () => {
        writePersisted(NAMESPACE, { currentFiltersValues: FILTER_VALUES, appliedFilters: [] }, SCOPE);

        const { result } = renderDataTable();

        expect(result.current.filters.currentFiltersValues).toEqual(FILTER_VALUES);
        expect(result.current.filters.isActive).toBe(false);
    });

    it("seleccionar un preset no lo aplica, y eso es lo que se persiste", async () => {
        userInformation.user = {
            id: "u1",
            filters: { application: { admin: { users: { "mi-filtro": FILTER_VALUES } } } },
        };
        const { result } = renderDataTable();

        act(() => result.current.filters.onFilterSelect("mi-filtro"));

        expect(result.current.filters.isActive).toBe(false);
        await waitFor(() => {
            const snapshot = readPersisted(NAMESPACE, SCOPE);
            expect(snapshot?.currentFiltersValues).toEqual(FILTER_VALUES);
            expect(snapshot?.appliedFilters).toEqual([]);
        });
    });

    it("la pasada de efectos del montaje ya no borra el estado restaurado", async () => {
        searchResult.total = { count: 500 };
        writePersisted(NAMESPACE, { pageIndex: 2, currentFiltersValues: FILTER_VALUES }, SCOPE);

        const { result } = renderDataTable();

        await waitFor(() => expect(result.current.query.isFetching).toBe(false));
        expect(result.current.pagination.page).toBe(3);
        expect(result.current.filters.currentFiltersValues).toEqual(FILTER_VALUES);
    });

    it("recorta a la pagina 1 si la pagina restaurada quedo fuera de rango", async () => {
        searchResult.total = { count: 5 };
        writePersisted(NAMESPACE, { pageIndex: 8, currentFiltersValues: FILTER_VALUES }, SCOPE);

        const { result } = renderDataTable();

        await waitFor(() => expect(result.current.pagination.page).toBe(1));
        expect(result.current.filters.currentFiltersValues).toEqual(FILTER_VALUES);
    });

    it("persiste los filtros aplicados", async () => {
        const { result } = renderDataTable();

        act(() => result.current.filters.onApply(FILTER_VALUES, 25));

        await waitFor(() => {
            const snapshot = readPersisted(NAMESPACE, SCOPE);
            expect(snapshot?.currentFiltersValues).toEqual(FILTER_VALUES);
            expect(snapshot?.appliedFilters).toEqual(Object.values(FILTER_VALUES));
            expect(snapshot?.pageSize).toBe(25);
        });
    });

    it("persiste el estado limpio al limpiar filtros", async () => {
        writePersisted(NAMESPACE, { currentFiltersValues: FILTER_VALUES, pageSize: 50 }, SCOPE);
        const { result } = renderDataTable();

        act(() => result.current.filters.onClear());

        await waitFor(() => {
            const snapshot = readPersisted(NAMESPACE, SCOPE);
            expect(snapshot?.currentFiltersValues).toEqual({});
            expect(snapshot?.pageSize).toBe(50);
        });
    });

    it("con persist:false no lee ni escribe nada", async () => {
        writePersisted(NAMESPACE, { pageIndex: 2, currentFiltersValues: FILTER_VALUES }, SCOPE);

        const { result } = renderDataTable({ ...CONFIG, persist: false });

        expect(result.current.pagination.page).toBe(1);
        expect(result.current.filters.currentFiltersValues).toEqual({});

        act(() => result.current.filters.onApply(FILTER_VALUES, 25));
        await waitFor(() => expect(readPersisted(NAMESPACE, SCOPE)?.pageIndex).toBe(2));
    });

    it("usa persistKey cuando la config lo declara y no lee el de la key base", async () => {
        searchResult.total = { count: 500 };
        writePersisted("datatable:users-abiertos", { pageIndex: 4 }, SCOPE);
        writePersisted(NAMESPACE, { pageIndex: 1 }, SCOPE);

        const { result } = renderDataTable({ ...CONFIG, persistKey: "users-abiertos" });

        expect(result.current.pagination.page).toBe(5);
    });

    it("limpia selectedFilter si el preset guardado ya no existe, conservando el filtro", async () => {
        writePersisted(NAMESPACE, { currentFiltersValues: FILTER_VALUES, selectedFilter: "borrado" }, SCOPE);

        const { result } = renderDataTable();

        expect(result.current.filters.currentFiltersValues).toEqual(FILTER_VALUES);
        await waitFor(() => expect(result.current.filters.selectedFilter).toBe(""));
    });

    it("un drill-in con location.state.filter manda sobre el estado persistido", async () => {
        searchResult.total = { count: 500 };
        writePersisted(NAMESPACE, { pageIndex: 3, currentFiltersValues: FILTER_VALUES }, SCOPE);
        locationMock.state = { filter: [{ field: "users.state", operator: "eq", type: "AND", value: 5 }] };

        const { result } = renderDataTable();

        expect(result.current.filters.currentFiltersValues).toEqual({});
        expect(result.current.pagination.page).toBe(1);
        await waitFor(() => expect(readPersisted(NAMESPACE, SCOPE)?.currentFiltersValues).toEqual({}));
    });

    it("dos tablas con la misma key y distinta view no comparten snapshot", () => {
        searchResult.total = { count: 500 };
        writePersisted(NAMESPACE, { pageIndex: 4 }, SCOPE);

        const { result } = renderDataTable({ ...CONFIG, view: "auxDefinitions", entity: "auxDefinitions" });

        expect(result.current.pagination.page).toBe(1);
    });

    it("restaura tras el arranque en frio, cuando el usuario aparece despues del primer render", async () => {
        searchResult.total = { count: 500 };
        writePersisted(NAMESPACE, { pageIndex: 2, currentFiltersValues: FILTER_VALUES }, SCOPE);
        userInformation.user = {};
        userInformation.active_group_id = null;

        const { result, rerender } = renderHook(() => useDataTable({ dataTableConfig: CONFIG }), { wrapper });
        expect(result.current.filters.currentFiltersValues).toEqual({});

        userInformation.user = { id: "u1", filters: {} };
        userInformation.active_group_id = "g1";
        act(() => rerender());

        await waitFor(() => expect(result.current.filters.currentFiltersValues).toEqual(FILTER_VALUES));
        expect(result.current.pagination.page).toBe(3);
    });

    /*
     * Leer y escribir tienen que seguir la misma clave: antes el snapshot inicial
     * quedaba sellado con el namespace viejo mientras el escritor ya usaba el nuevo.
     */
    it("al cambiar de namespace no escribe el estado anterior bajo la clave nueva", async () => {
        searchResult.total = { count: 500 };
        writePersisted(NAMESPACE, { pageIndex: 3, appliedFilters: Object.values(FILTER_VALUES) }, SCOPE);

        const { result, rerender } = renderHook(({ config }) => useDataTable({ dataTableConfig: config }), {
            wrapper,
            initialProps: { config: CONFIG },
        });
        expect(result.current.pagination.page).toBe(4);

        act(() => rerender({ config: { ...CONFIG, view: "otra-vista", entity: "otra-vista" } }));

        await waitFor(() => expect(result.current.pagination.page).toBe(1));
        expect(readPersisted("datatable:users:otra-vista", SCOPE)?.pageIndex ?? 0).toBe(0);
        expect(readPersisted(NAMESPACE, SCOPE)?.pageIndex).toBe(3);
    });

    it("una accion del usuario en frio gana sobre la restauracion tardia", async () => {
        writePersisted(NAMESPACE, { pageSize: 100 }, SCOPE);
        userInformation.user = {};
        userInformation.active_group_id = null;

        const { result, rerender } = renderHook(() => useDataTable({ dataTableConfig: CONFIG }), { wrapper });
        act(() => result.current.pagination.onPageSizeChange(25));

        userInformation.user = { id: "u1", filters: {} };
        userInformation.active_group_id = "g1";
        act(() => rerender());

        await waitFor(() => expect(result.current.pagination.pageSize).toBe(25));
    });

    it("conserva selectedFilter cuando el preset sigue existiendo", async () => {
        userInformation.user = {
            id: "u1",
            filters: { application: { admin: { users: { "mi-filtro": FILTER_VALUES } } } },
        };
        writePersisted(NAMESPACE, { currentFiltersValues: FILTER_VALUES, selectedFilter: "mi-filtro" }, SCOPE);

        const { result } = renderDataTable();

        expect(result.current.filters.selectedFilter).toBe("mi-filtro");
        await waitFor(() => expect(result.current.filters.savedFilterList).toEqual(["mi-filtro"]));
        expect(result.current.filters.selectedFilter).toBe("mi-filtro");
    });
});

describe("useDataTable — Cases header namespace for the advanced filter schema", () => {
    it("passes the columnsCases namespace to getSchemaFilter for a Cases dataTableConfig", () => {
        renderDataTable({ key: "cases", url: "/cases", view: "cases", entity: "view_casos" });

        expect(getSchemaFilterMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), [], "columnsCases");
    });

    it("does not pass a namespace for a non-Cases dataTableConfig", () => {
        renderDataTable();

        expect(getSchemaFilterMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), [], undefined);
    });
});
