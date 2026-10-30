import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { normalizeTableDateRangeFilter } from "@kace/utils";
import { FILTER_SCOPES, resolveDateFilterOperator, validateSearchToTable } from "../helpers";
import { buildFilterCriteriaFromForm } from "./buildFilterCriteriaFromForm";
import { URL_AND_KEYS } from "../../../../../../utils/urlAndKeys";
import { createCasesFilterCriterionResolver } from "../../../../../../pages/Cases/components/CaseDataTable/utils/transformNivelFilters";

const mocks = vi.hoisted(() => ({
    dispatch: vi.fn(),
    post: vi.fn(),
    setQueryData: vi.fn(),
    fetchQuery: vi.fn(async () => ({ data: [] })),
    toast: { info: vi.fn(), error: vi.fn(), warning: vi.fn(), promise: vi.fn(), dismiss: vi.fn() },
    user: null,
    schemaFields: [],
}));

vi.mock("react-redux", () => ({ useDispatch: () => mocks.dispatch }));
vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        fetchQuery: mocks.fetchQuery,
        setQueryData: mocks.setQueryData,
    }),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@kace/utils", async (importOriginal) => ({
    ...(await importOriginal()),
    apiService: { post: mocks.post },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
vi.mock("../../../../../../hooks/useUserInformation", () => ({ default: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ getSchemaField: () => mocks.schemaFields }),
}));
vi.mock("../../../../../../services/genericSearchService", () => ({ genericSearchService: vi.fn() }));
vi.mock("../../../../../../redux/state/filterCases", () => ({
    setFilterCases: (payload) => ({ type: "filterCases/set", payload }),
}));
vi.mock("../../../../../../services/createSchemaFilter", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, resolveGridColumnHeader: vi.fn(actual.resolveGridColumnHeader) };
});

const { resolveGridColumnHeader } = await import("../../../../../../services/createSchemaFilter");

const { default: useHookFilter } = await import("./useHookFilter");

describe("buildFilterCriteriaFromForm", () => {
    const baseNameTable = { view: "cases", key: "cases" };

    it("filters UUID foreign keys with eq even when the value is a string", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: {
                grupo_id: "group-uuid",
                responsable_id: "user-uuid",
                nombre: "BO",
            },
            nameTable: baseNameTable,
            fieldsCustomerFilters: null,
            resolveDateOperator: resolveDateFilterOperator,
            validateSearchToTable: () => null,
            casesTable: false,
            normalizeDateRange: (value) => value,
        });

        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: "cases.grupo_id", operator: "eq", value: "group-uuid" }),
                expect.objectContaining({ field: "cases.responsable_id", operator: "eq", value: "user-uuid" }),
                expect.objectContaining({ field: "cases.nombre", operator: "ilike", value: "BO" }),
            ]),
        );
    });

    it("filters edited_by with eq like created_by when the value is a user id", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: {
                created_by: "user-created",
                edited_by: "user-edited",
            },
            nameTable: baseNameTable,
            fieldsCustomerFilters: null,
            resolveDateOperator: resolveDateFilterOperator,
            validateSearchToTable: () => null,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ column: "cases.created_by", operator: "eq", value: "user-created" }),
                expect.objectContaining({ column: "cases.edited_by", operator: "eq", value: "user-edited" }),
            ]),
        );
    });

    it("uses between and cases.sla_due_date when resolveFilterCriterion maps fecha_vencimiento", () => {
        const resolveFilterCriterion = ({ field, value }) =>
            field === "fecha_vencimiento" ? { field: "cases.sla_due_date", value } : { field, value };

        const result = buildFilterCriteriaFromForm({
            dataForm: {
                fecha_vencimiento: "2026-01-01T00:00:00.000Z, 2026-01-01T23:59:59.999Z",
            },
            nameTable: { ...baseNameTable, resolveFilterCriterion },
            fieldsCustomerFilters: null,
            resolveDateOperator: resolveDateFilterOperator,
            validateSearchToTable: () => null,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result).toHaveLength(1);
        expect(result[0].operator).toBe("between");
        expect(result[0].column).toBe("cases.sla_due_date");
    });

    it("maps fecha_vencimiento to cases.sla_due_date on the massive execution screen", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: {
                fecha_vencimiento: "2026-08-12T19:00:00.000-05, 2026-08-29T18:59:59.999-05",
            },
            nameTable: {
                view: "cases",
                key: "actionJobsFilterCases",
                resolveFilterCriterion: createCasesFilterCriterionResolver({ isCustomView: false }),
            },
            fieldsCustomerFilters: [],
            resolveDateOperator: resolveDateFilterOperator,
            validateSearchToTable,
            casesTable: false,
            normalizeDateRange: (value) => value,
        });

        expect(result).toEqual([
            {
                operator: "between",
                value: "2026-08-12T19:00:00.000-05, 2026-08-29T18:59:59.999-05",
                type: "AND",
                field: "cases.sla_due_date",
            },
        ]);
        expect(result[0]).not.toHaveProperty("column");
    });

    it("resolves the remaining view_casos aliases on the massive execution screen", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: {
                grupo_nombre: "BO",
                responsable_nombre: "Ana",
                estado_id: "uuid-1",
                estadoActual: "ESCALADO",
            },
            nameTable: {
                view: "cases",
                key: "actionJobsFilterCases",
                resolveFilterCriterion: createCasesFilterCriterionResolver({ isCustomView: false }),
            },
            fieldsCustomerFilters: [],
            resolveDateOperator: resolveDateFilterOperator,
            validateSearchToTable,
            casesTable: false,
            normalizeDateRange: (value) => value,
        });

        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: "grupos.nombre", operator: "ilike" }),
                expect.objectContaining({ field: "responsable.nombres", operator: "ilike" }),
                expect.objectContaining({ field: "estados.id", operator: "eq" }),
                expect.objectContaining({ field: "estados.nombre", operator: "ilike" }),
            ]),
        );
        expect(result).toHaveLength(4);
    });

    /*
     * resolveFilterCriterion y fieldsCustomerFilters pueden mapear el mismo campo. Este caso fija cual manda
     * para que nadie ajuste el newValue esperando que tenga efecto mientras el resolvedor este activo.
     */
    it("lets resolveFilterCriterion win over a conflicting fieldsCustomerFilters mapping", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { estadoActual: "ESCALADO" },
            nameTable: {
                view: "cases",
                key: "actionJobsFilterCases",
                resolveFilterCriterion: createCasesFilterCriterionResolver({ isCustomView: false }),
            },
            fieldsCustomerFilters: [{ field: "estadoActual", newValue: "obsoleto.columna" }],
            resolveDateOperator: () => null,
            validateSearchToTable,
            casesTable: false,
            normalizeDateRange: (value) => value,
        });

        expect(result[0].field).toBe("estados.nombre");
    });

    it("drops date criteria when normalizeDateRange returns null", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { fecha_resolucion: "not-a-date" },
            nameTable: baseNameTable,
            fieldsCustomerFilters: null,
            resolveDateOperator: resolveDateFilterOperator,
            validateSearchToTable: () => null,
            casesTable: true,
            normalizeDateRange: () => null,
        });

        expect(result).toEqual([]);
    });

    it("uses eq for declared number fields even when the form value is a digit string", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { antiguedad_dias: "12" },
            nameTable: baseNameTable,
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable: () => null,
            casesTable: true,
            normalizeDateRange: (value) => value,
            numberFieldNames: ["antiguedad_dias"],
        });

        expect(result[0]).toEqual(
            expect.objectContaining({
                operator: "eq",
                value: 12,
                column: "cases.antiguedad_dias",
            }),
        );
    });

    it("uses aliased joined columns from resolveFilterCriterion for estado and grupo", () => {
        const resolveFilterCriterion = ({ field, value }) => {
            if (field === "estado_id") return { field: "estados.id", value };
            if (field === "grupo_nombre") return { field: "grupos.nombre", value };
            return { field, value };
        };

        const result = buildFilterCriteriaFromForm({
            dataForm: { estado_id: "uuid-1", grupo_nombre: "BO" },
            nameTable: { ...baseNameTable, resolveFilterCriterion },
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable: () => null,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ column: "estados.id", value: "uuid-1" }),
                expect.objectContaining({ column: "grupos.nombre", value: "BO" }),
            ]),
        );
    });

    it("maps nivel2/Foo via resolveFilterCriterion", () => {
        const resolveFilterCriterion = ({ value }) =>
            value === "nivel2/Foo" ? { field: "clasificaciones.nivel2", value: "Foo" } : { field: "nivel1", value };

        const result = buildFilterCriteriaFromForm({
            dataForm: { nivel1: "nivel2/Foo" },
            nameTable: { ...baseNameTable, resolveFilterCriterion },
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable: () => null,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result[0].column).toBe("clasificaciones.nivel2");
        expect(result[0].value).toBe("Foo");
    });

    it("omits criterion when resolveFilterCriterion returns null", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { nivel1: "nivel2/null" },
            nameTable: {
                ...baseNameTable,
                resolveFilterCriterion: () => null,
            },
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable: () => null,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result).toEqual([]);
    });

    it("qualifies with the view when resolveFilterCriterion leaves the field unchanged", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { reference: "R1" },
            nameTable: {
                ...baseNameTable,
                resolveFilterCriterion: ({ field, value }) => ({ field, value }),
            },
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result[0].column).toBe("cases.reference");
    });

    it("qualifies custom-view fields with the view name", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { titulo: "abc" },
            nameTable: {
                view: "view_case_details",
                key: "cases",
                resolveFilterCriterion: ({ field, value }) => ({ field, value }),
            },
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result[0].column).toBe("view_case_details.titulo");
    });

    it("uses operator from resolveFilterCriterion for integer reference", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { reference: "42" },
            nameTable: {
                ...baseNameTable,
                resolveFilterCriterion: createCasesFilterCriterionResolver({ isCustomView: false }),
            },
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result[0]).toEqual(
            expect.objectContaining({
                operator: "eq",
                value: 42,
                column: "cases.reference",
            }),
        );
    });

    it("keeps validateSearchToTable mappings for pass-through cases fields", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { nombres: "Ana", nombre_cliente: "Acme", documento: "123" },
            nameTable: {
                ...baseNameTable,
                resolveFilterCriterion: ({ field, value }) => ({ field, value }),
            },
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result.map((criterion) => criterion.column)).toEqual([
            "responsable.nombres",
            "clients.nombres",
            "clients.documento",
        ]);
    });

    it("prefers fieldsCustomerFilters mapping over the view prefix", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { custom_field: "X" },
            nameTable: {
                ...baseNameTable,
                resolveFilterCriterion: ({ field, value }) => ({ field, value }),
            },
            fieldsCustomerFilters: [{ field: "custom_field", newValue: "propiedades.custom_field" }],
            resolveDateOperator: () => null,
            validateSearchToTable,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result[0].column).toBe("propiedades.custom_field");
    });

    it("keeps non-string values untouched through the resolver pass-through", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { assigned_to: 42 },
            nameTable: {
                ...baseNameTable,
                resolveFilterCriterion: ({ field, value }) => ({ field, value }),
            },
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result[0].value).toBe(42);
        expect(result[0].operator).toBe("eq");
    });

    it("preserves legacy transformFilterField behavior without a criterion resolver", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { nivel1: "nivel2/Foo" },
            nameTable: {
                ...baseNameTable,
                transformFilterField: () => "clasificaciones.nivel2",
            },
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable: () => null,
            casesTable: true,
            normalizeDateRange: (value) => value,
        });

        expect(result[0].column).toBe("clasificaciones.nivel2");
        expect(result[0].value).toBe("Foo");
    });

    it("normalizes created_at between with Bogota offset via real helper", () => {
        const criteria = buildFilterCriteriaFromForm({
            dataForm: {
                created_at: "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z",
            },
            nameTable: { view: "cases", key: "cases" },
            fieldsCustomerFilters: [],
            resolveDateOperator: resolveDateFilterOperator,
            validateSearchToTable,
            casesTable: false,
            normalizeDateRange: (value) => normalizeTableDateRangeFilter(value, "America/Bogota", { mode: "date" }),
            numberFieldNames: [],
        });

        expect(criteria).toEqual([
            expect.objectContaining({
                field: "cases.created_at",
                operator: "between",
                value: "2026-07-23T00:00:00.000-05:00, 2026-07-23T23:59:59.999-05:00",
                type: "AND",
            }),
        ]);
    });
});

describe("useHookFilter restore and delete", () => {
    const nameTable = {
        key: URL_AND_KEYS.cases.key,
        view: "cases",
        entity: "cases",
        url: "/cases",
        resolveFilterCriterion: createCasesFilterCriterionResolver({ isCustomView: false }),
    };

    const renderFilterHook = () =>
        renderHook(() =>
            useHookFilter({
                nameHelper: [],
                nameTable,
                setValue: vi.fn(),
                reset: vi.fn(),
                fieldsCustomerFilters: null,
            }),
        );

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            filters: {
                application: { agente: { cases: { Mine: { reference: "1" }, Other: { reference: "2" } } } },
            },
        };
        mocks.schemaFields = [{ column_name: "reference", label: "reference" }];
    });

    it("dispatches the restored criteria without offering to save the filter", async () => {
        const { result } = renderFilterHook();

        let restored;
        await act(async () => {
            restored = result.current.handleSelectFilter("Mine");
        });

        expect(restored).toEqual({ reference: "1" });
        expect(mocks.dispatch).toHaveBeenCalledWith({
            type: "filterCases/set",
            payload: [
                {
                    operator: "eq",
                    value: 1,
                    type: "AND",
                    column: "cases.reference",
                    title: "app.text.filteredCases",
                },
            ],
        });
        expect(mocks.toast.info).not.toHaveBeenCalled();
    });

    it("returns an empty object when the saved filter is missing", async () => {
        const { result } = renderFilterHook();

        let restored;
        await act(async () => {
            restored = result.current.handleSelectFilter("Missing");
        });

        expect(restored).toEqual({});
        expect(mocks.dispatch).not.toHaveBeenCalled();
    });

    it("restores form fields from formColumnNames even when schema columns differ", async () => {
        mocks.user.filters.application.agente.cases.Mine = { estadoActual: "ESCALADO" };
        mocks.schemaFields = [{ column_name: "estado_actual", label: "estado_actual" }];

        const { result } = renderHook(() =>
            useHookFilter({
                nameHelper: [],
                nameTable,
                setValue: vi.fn(),
                reset: vi.fn(),
                fieldsCustomerFilters: null,
                formColumnNames: ["estadoActual", "reference"],
            }),
        );

        let restored;
        await act(async () => {
            restored = result.current.handleSelectFilter("Mine");
        });

        expect(restored).toEqual({ estadoActual: "ESCALADO" });
        expect(mocks.dispatch).toHaveBeenCalled();
        expect(mocks.toast.info).not.toHaveBeenCalledWith("app.text.noFiltersToApply");
    });

    it("still offers to update the selected filter after the restore auto-apply", async () => {
        const { result } = renderFilterHook();

        await act(async () => {
            result.current.handleSelectFilter("Mine");
        });
        await act(async () => {
            await result.current.onSubmit({ reference: "9" }, true);
        });

        expect(mocks.toast.info).toHaveBeenCalledWith("app.text.confirmUpdateFilter", expect.anything());
    });

    it("keeps offering update on later submits while the saved filter stays selected", async () => {
        const { result } = renderFilterHook();

        await act(async () => {
            result.current.handleSelectFilter("Mine");
        });
        await act(async () => {
            await result.current.onSubmit({ reference: "9" }, true);
        });
        mocks.toast.info.mockClear();
        await act(async () => {
            await result.current.onSubmit({ reference: "10" }, true);
        });

        expect(mocks.toast.info).toHaveBeenCalledWith("app.text.confirmUpdateFilter", expect.anything());
    });

    it("offers to save a new filter after clearing the selected saved filter", async () => {
        const { result } = renderFilterHook();

        await act(async () => {
            result.current.handleSelectFilter("Mine");
        });
        await act(async () => {
            result.current.clearSelectedSavedFilter();
        });
        await act(async () => {
            await result.current.onSubmit({ reference: "9" }, true);
        });

        expect(mocks.toast.info).toHaveBeenCalledWith("app.text.confirmSaveFilter", expect.anything());
        expect(mocks.toast.info).not.toHaveBeenCalledWith("app.text.confirmUpdateFilter", expect.anything());
    });

    it("offers to save when searching without a selected saved filter", async () => {
        const { result } = renderFilterHook();

        await act(async () => {
            await result.current.onSubmit({ reference: "9" }, true);
        });

        expect(mocks.toast.info).toHaveBeenCalledWith(
            "app.text.confirmSaveFilter",
            expect.objectContaining({
                action: expect.objectContaining({ label: "app.button.yes" }),
            }),
        );
    });

    it("rejects creating a filter when the name already exists", async () => {
        const { result } = renderFilterHook();

        await act(async () => {
            await result.current.onSubmit({ reference: "9" }, true);
        });

        let saved;
        await act(async () => {
            saved = await result.current.handleNewFilter("Mine");
        });

        expect(saved).toBe(false);
        expect(mocks.toast.error).toHaveBeenCalledWith("app.text.filterNameExists");
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it("updates dataFiltersUser with a new object reference after a successful save", async () => {
        mocks.post.mockResolvedValue({ status: 200 });
        const { result } = renderFilterHook();

        await act(async () => {
            await result.current.onSubmit({ reference: "9" }, true);
        });

        const previous = result.current.dataFiltersUser;
        await act(async () => {
            await result.current.handleNewFilter("BrandNew");
        });

        expect(result.current.dataFiltersUser).not.toBe(previous);
        expect(result.current.dataFiltersUser.filters.application.agente.cases).toHaveProperty("BrandNew");
    });

    it("does not mutate local filters when the save request fails", async () => {
        mocks.post.mockRejectedValue(new Error("network"));
        const { result } = renderFilterHook();

        await act(async () => {
            await result.current.onSubmit({ reference: "9" }, true);
        });

        let saved;
        await act(async () => {
            saved = await result.current.handleNewFilter("BrandNew");
        });

        expect(saved).toBe(false);
        expect(result.current.dataFiltersUser.filters.application.agente.cases).not.toHaveProperty("BrandNew");
        expect(mocks.user.filters.application.agente.cases).not.toHaveProperty("BrandNew");
    });

    it("keeps the filter listed and reports failure when the delete request rejects", async () => {
        mocks.post.mockRejectedValue(new Error("network"));
        const { result } = renderFilterHook();

        let deleted;
        await act(async () => {
            deleted = await result.current.handleDeleteFilter("Mine");
        });

        expect(deleted).toBe(false);
        expect(mocks.toast.error).toHaveBeenCalledWith("network");
        expect(result.current.dataFiltersUser.filters.application.agente.cases).toHaveProperty("Mine");
    });

    it("removes only the requested filter when the delete request resolves", async () => {
        mocks.post.mockResolvedValue({ status: 200 });
        const { result } = renderFilterHook();

        let deleted;
        await act(async () => {
            deleted = await result.current.handleDeleteFilter("Mine");
        });

        expect(deleted).toBe(true);
        expect(result.current.dataFiltersUser.filters.application.agente.cases).not.toHaveProperty("Mine");
        expect(result.current.dataFiltersUser.filters.application.agente.cases).toHaveProperty("Other");
    });
});

describe("useHookFilter scope fallback and isolation", () => {
    const nameTable = {
        key: URL_AND_KEYS.cases.key,
        view: "cases",
        entity: "cases",
        url: "/cases",
        resolveFilterCriterion: createCasesFilterCriterionResolver({ isCustomView: false }),
    };

    const renderFilterHook = (scope) =>
        renderHook(() =>
            useHookFilter({
                nameHelper: [],
                nameTable,
                setValue: vi.fn(),
                reset: vi.fn(),
                fieldsCustomerFilters: null,
                ...(scope ? { scope } : {}),
            }),
        );

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.schemaFields = [{ column_name: "reference", label: "reference" }];
    });

    it("restores a filter that only exists in the legacy admin scope (agente default)", async () => {
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            filters: { application: { admin: { cases: { Legacy: { reference: "5" } } } } },
        };
        const { result } = renderFilterHook();

        let restored;
        await act(async () => {
            restored = result.current.handleSelectFilter("Legacy");
        });

        expect(restored).toEqual({ reference: "5" });
    });

    it("does not show a scope's filters through a scope that has its own filters (no fallback needed)", async () => {
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            filters: {
                application: {
                    agente: { cases: { OwnFilter: { reference: "1" } } },
                    admin: { cases: { Legacy: { reference: "9" } } },
                },
            },
        };
        const { result } = renderFilterHook();

        let restored;
        await act(async () => {
            restored = result.current.handleSelectFilter("Legacy");
        });

        expect(restored).toEqual({});
    });

    it("rejects a duplicate name for a new agente filter when the name only exists via the admin fallback", async () => {
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            filters: { application: { admin: { cases: { Legacy: { reference: "5" } } } } },
        };
        const { result } = renderFilterHook();

        await act(async () => {
            await result.current.onSubmit({ reference: "1" }, true);
        });

        let saved;
        await act(async () => {
            saved = await result.current.handleNewFilter("Legacy");
        });

        expect(saved).toBe(false);
        expect(mocks.toast.error).toHaveBeenCalledWith("app.text.filterNameExists");
    });

    it("seeds agente with a copy of admin's filters when saving the first agente filter, keeping admin intact", async () => {
        mocks.post.mockResolvedValue({ status: 200 });
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            filters: { application: { admin: { cases: { Legacy: { reference: "5" } } } } },
        };
        const { result } = renderFilterHook();

        await act(async () => {
            await result.current.onSubmit({ reference: "1" }, true);
        });
        await act(async () => {
            await result.current.handleNewFilter("NewOne");
        });

        const savedFilters = mocks.post.mock.calls[0][1].filters;
        expect(savedFilters.application.agente.cases).toEqual({
            Legacy: { reference: "5" },
            NewOne: { reference: "1" },
        });
        expect(savedFilters.application.admin.cases).toEqual({ Legacy: { reference: "5" } });
        expect(mocks.user.filters.application).not.toHaveProperty("agente");
    });

    it("does not reseed agente from admin once agente already has its own filters", async () => {
        mocks.post.mockResolvedValue({ status: 200 });
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            filters: {
                application: {
                    agente: { cases: { OwnFilter: { reference: "1" } } },
                    admin: { cases: { Legacy: { reference: "9" } } },
                },
            },
        };
        const { result } = renderFilterHook();

        await act(async () => {
            await result.current.onSubmit({ reference: "2" }, true);
        });
        await act(async () => {
            await result.current.handleNewFilter("AnotherOne");
        });

        const savedFilters = mocks.post.mock.calls[0][1].filters;
        expect(savedFilters.application.agente.cases).toEqual({
            OwnFilter: { reference: "1" },
            AnotherOne: { reference: "2" },
        });
    });

    it("does not let admin filters reappear (nor reseeds again) once agente exists but every agente filter got deleted", async () => {
        mocks.post.mockResolvedValue({ status: 200 });
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            filters: { application: { admin: { cases: { Legacy: { reference: "5" } } } } },
        };
        const { result, rerender } = renderFilterHook();

        // Step 1: seed agente from admin on the first agente save.
        await act(async () => {
            await result.current.onSubmit({ reference: "1" }, true);
        });
        await act(async () => {
            await result.current.handleNewFilter("NewOne");
        });
        let savedFilters = mocks.post.mock.calls.at(-1)[1].filters;
        expect(savedFilters.application.agente.cases).toEqual({
            Legacy: { reference: "5" },
            NewOne: { reference: "1" },
        });
        /*
         * Simulate the server-confirmed user object the app would refetch after the save, and force
         * the hook to re-render so its handlers close over the fresh user (mirrors a real refetch).
         */
        mocks.user = { ...mocks.user, filters: savedFilters };
        rerender();

        // Step 2: delete every agente filter, one at a time.
        await act(async () => {
            await result.current.handleDeleteFilter("Legacy");
        });
        savedFilters = mocks.post.mock.calls.at(-1)[1].filters;
        expect(savedFilters.application.agente.cases).toEqual({ NewOne: { reference: "1" } });
        expect(savedFilters.application.admin.cases).toEqual({ Legacy: { reference: "5" } });
        mocks.user = { ...mocks.user, filters: savedFilters };
        rerender();

        await act(async () => {
            await result.current.handleDeleteFilter("NewOne");
        });
        savedFilters = mocks.post.mock.calls.at(-1)[1].filters;
        expect(savedFilters.application.agente.cases).toEqual({});
        expect(savedFilters.application.admin.cases).toEqual({ Legacy: { reference: "5" } });
        mocks.user = { ...mocks.user, filters: savedFilters };
        rerender();

        // agente.cases now exists (empty). Admin's legacy filter must NOT reappear in reads...
        let restored;
        await act(async () => {
            restored = result.current.handleSelectFilter("Legacy");
        });
        expect(restored).toEqual({});

        // ...nor be deletable through the agente scope (own scope exists, so no admin fallback)...
        let deleted;
        await act(async () => {
            deleted = await result.current.handleDeleteFilter("Legacy");
        });
        expect(deleted).toBe(false);
        expect(mocks.user.filters.application.admin.cases).toEqual({ Legacy: { reference: "5" } });

        // ...nor get reseeded from admin on the next agente save.
        await act(async () => {
            await result.current.onSubmit({ reference: "2" }, true);
        });
        await act(async () => {
            await result.current.handleNewFilter("FreshStart");
        });
        savedFilters = mocks.post.mock.calls.at(-1)[1].filters;
        expect(savedFilters.application.agente.cases).toEqual({ FreshStart: { reference: "2" } });
        expect(savedFilters.application.admin.cases).toEqual({ Legacy: { reference: "5" } });
    });

    it("keeps writes and reads isolated to an explicit ADMIN scope, untouched by agente data", async () => {
        mocks.post.mockResolvedValue({ status: 200 });
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            filters: {
                application: {
                    agente: { cases: { AgentFilter: { reference: "1" } } },
                    admin: { cases: { AdminFilter: { reference: "2" } } },
                },
            },
        };
        const { result } = renderFilterHook(FILTER_SCOPES.ADMIN);

        let restoredAgentName;
        await act(async () => {
            restoredAgentName = result.current.handleSelectFilter("AgentFilter");
        });
        expect(restoredAgentName).toEqual({});

        await act(async () => {
            await result.current.onSubmit({ reference: "3" }, true);
        });
        await act(async () => {
            await result.current.handleNewFilter("AdminOnly");
        });

        const savedFilters = mocks.post.mock.calls[0][1].filters;
        expect(savedFilters.application.admin.cases).toEqual({
            AdminFilter: { reference: "2" },
            AdminOnly: { reference: "3" },
        });
        expect(savedFilters.application.agente.cases).toEqual({ AgentFilter: { reference: "1" } });
    });

    it("resolves selected-filter column headers through the Cases-specific i18n namespace", async () => {
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            filters: { application: { agente: { cases: { Mine: { reference: "1" } } } } },
        };
        resolveGridColumnHeader.mockClear();
        const { result } = renderFilterHook();

        await act(async () => {
            result.current.handleSelectFilter("Mine");
        });

        expect(resolveGridColumnHeader).toHaveBeenCalledWith(
            expect.objectContaining({ column_name: "reference" }),
            expect.any(Function),
            "columnsCases",
        );
    });

    it("does not apply the Cases namespace when resolving headers for a non-Cases table", async () => {
        resolveGridColumnHeader.mockClear();
        const nonCasesNameTable = { key: "roles", view: "roles", entity: "roles", url: "/roles" };
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            filters: { application: { agente: { roles: { Mine: { reference: "1" } } } } },
        };
        const { result } = renderHook(() =>
            useHookFilter({
                nameHelper: [],
                nameTable: nonCasesNameTable,
                setValue: vi.fn(),
                reset: vi.fn(),
                fieldsCustomerFilters: null,
            }),
        );

        await act(async () => {
            result.current.handleSelectFilter("Mine");
        });

        expect(resolveGridColumnHeader).toHaveBeenCalledWith(
            expect.objectContaining({ column_name: "reference" }),
            expect.any(Function),
            undefined,
        );
    });

    it("deletes a filter only visible via the admin fallback end to end", async () => {
        mocks.post.mockResolvedValue({ status: 200 });
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            filters: { application: { admin: { cases: { Legacy: { reference: "5" } } } } },
        };
        const { result } = renderFilterHook();

        let deleted;
        await act(async () => {
            deleted = await result.current.handleDeleteFilter("Legacy");
        });

        expect(deleted).toBe(true);
        const savedFilters = mocks.post.mock.calls[0][1].filters;
        expect(savedFilters.application.admin.cases).not.toHaveProperty("Legacy");
    });
});

/*
 * SelectByListLevels emite "nivelX/null" en cuanto se elige un nivel sin escoger valor, y el resolvedor lo
 * descarta. En Ejecucion Masiva ese filtro define el alcance de una accion irreversible, asi que el descarte
 * no puede pasar inadvertido ni dejar que la busqueda se ejecute sin criterios.
 */
describe("useHookFilter discarded criteria guard", () => {
    const nameTable = {
        key: "actionJobsFilterCases",
        view: "cases",
        entity: "cases",
        url: "/cases",
        resolveFilterCriterion: createCasesFilterCriterionResolver({ isCustomView: false }),
    };

    const renderFilterHook = () =>
        renderHook(() =>
            useHookFilter({
                nameHelper: [],
                nameTable,
                setValue: vi.fn(),
                reset: vi.fn(),
                fieldsCustomerFilters: [],
            }),
        );

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user = { id: "user-1", account_type: "admin", grupo_activo: "g1", filters: {} };
        mocks.schemaFields = [{ column_name: "reference", label: "reference" }];
    });

    it("warns and keeps searching when only some criteria are discarded", async () => {
        const { result } = renderFilterHook();

        await act(async () => {
            await result.current.onSubmit({ nivel1: "nivel2/null", estadoActual: "ESCALADO" }, false);
        });

        expect(mocks.toast.warning).toHaveBeenCalledWith("app.text.someFiltersDiscarded");
        expect(mocks.dispatch).toHaveBeenCalledWith({
            type: "filterCases/set",
            payload: [expect.objectContaining({ field: "estados.nombre", value: "ESCALADO" })],
        });
    });

    it("aborts the search when every filled criterion is discarded", async () => {
        const { result } = renderFilterHook();

        await act(async () => {
            await result.current.onSubmit({ nivel1: "nivel2/null" }, false);
        });

        expect(mocks.toast.warning).toHaveBeenCalledWith("app.text.someFiltersDiscarded");
        expect(mocks.dispatch).not.toHaveBeenCalled();
        expect(mocks.fetchQuery).not.toHaveBeenCalled();
    });

    it("stays quiet when no criterion is discarded", async () => {
        const { result } = renderFilterHook();

        await act(async () => {
            await result.current.onSubmit({ estadoActual: "ESCALADO" }, false);
        });

        expect(mocks.toast.warning).not.toHaveBeenCalled();
        expect(mocks.fetchQuery).toHaveBeenCalled();
    });
});
