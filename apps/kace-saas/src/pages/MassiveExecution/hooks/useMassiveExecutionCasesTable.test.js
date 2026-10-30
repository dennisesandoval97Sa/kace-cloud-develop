import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import i18n from "@/locale/i18n";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

/*
 * Columnas de view_casos tal como las entrega /schema-fields: `label` sale de LABELS del backend
 * (field-list/domain/labels.js) y es "undefined" cuando la columna no tiene etiqueta.
 */
const VIEW_CASOS_SCHEMA = [
    { column_name: "created_at", data_type: "Date", label: "Created at" },
    { column_name: "edited_at", data_type: "Date", label: "undefined" },
    { column_name: "edited_by", data_type: "String", label: "undefined" },
    { column_name: "fecha_resolucion", data_type: "Date", label: "Resolution date" },
    { column_name: "parent_id", data_type: "String", label: "undefined" },
    { column_name: "reference", data_type: "Number", label: "Reference" },
    { column_name: "responsable_id", data_type: "String", label: "Responsible ID" },
    { column_name: "grupo_id", data_type: "String", label: "Group ID" },
    { column_name: "fecha_vencimiento", data_type: "Date", label: "undefined" },
    { column_name: "updated_at", data_type: "Date", label: "Updated at" },
    { column_name: "nivel1", data_type: "String", label: "Level 1" },
    { column_name: "estado_id", data_type: "String", label: "undefined" },
    { column_name: "estado_actual", data_type: "String", label: "Current state" },
    { column_name: "grupo_nombre", data_type: "String", label: "undefined" },
    { column_name: "nombres", data_type: "String", label: "First names" },
    { column_name: "apellido1", data_type: "String", label: "First surname" },
    { column_name: "apellido2", data_type: "String", label: "Second surname" },
    { column_name: "responsable_nombre", data_type: "String", label: "undefined" },
    { column_name: "nombre_cliente", data_type: "String", label: "First names" },
    { column_name: "documento", data_type: "String", label: "Document" },
    { column_name: "transicion_id", data_type: "String", label: "Transition ID" },
];

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({
        getSchemaField: (entity) => {
            if (entity !== URL_AND_KEYS.cases.entity) throw new Error(`Entidad inesperada: ${entity}`);
            return VIEW_CASOS_SCHEMA;
        },
    }),
}));
vi.mock("../../../hooks/useGenericSearchQuery", () => ({
    default: () => ({ data: [], refetch: vi.fn(), isFetching: false, isError: false }),
}));
vi.mock("@tanstack/react-query", () => ({ useIsFetching: () => 0 }));

const { default: useMassiveExecutionCasesTable } = await import("./useMassiveExecutionCasesTable");

const renderFilterHeaders = async (language) => {
    await i18n.changeLanguage(language);
    const { result } = renderHook(() => useMassiveExecutionCasesTable());
    return Object.fromEntries(result.current.columnsToFilter.map(({ column_name, header }) => [column_name, header]));
};

describe("useMassiveExecutionCasesTable - filtros por caso", () => {
    afterEach(async () => {
        await i18n.changeLanguage("es");
    });

    it("no expone Responsable Nombre: el filtro Responsable ya busca por el nombre del responsable", async () => {
        const headers = await renderFilterHeaders("es");

        expect(headers).not.toHaveProperty("responsable_nombre");
        expect(headers).toHaveProperty("nombres");
    });

    it("traduce todos los campos del filtro en español", async () => {
        expect(await renderFilterHeaders("es")).toEqual({
            nivel1: "Niveles",
            created_at: "Creado",
            edited_at: "Última gestión",
            edited_by: "Gestionado por",
            fecha_resolucion: "Fecha resolución",
            parent_id: "ID del caso padre",
            reference: "Caso",
            responsable_id: "ID del responsable",
            grupo_id: "Grupo ID",
            fecha_vencimiento: "Fecha de vencimiento",
            updated_at: "Actualizado",
            estado_id: "ID del estado",
            estadoActual: "Estado actual",
            grupo_nombre: "Nombre del grupo",
            nombres: "Nombre responsable",
            apellido1: "Primer apellido responsable",
            apellido2: "Segundo apellido responsable",
            nombre_cliente: "Cliente",
            documento: "Documento cliente",
            transicion_id: "ID de transición",
        });
    });

    it("traduce todos los campos del filtro en inglés", async () => {
        expect(await renderFilterHeaders("en")).toEqual({
            nivel1: "Levels",
            created_at: "Created",
            edited_at: "Last handled",
            edited_by: "Handled by",
            fecha_resolucion: "Resolution date",
            parent_id: "Parent case ID",
            reference: "Case",
            responsable_id: "Responsible ID",
            grupo_id: "Group ID",
            fecha_vencimiento: "Due date",
            updated_at: "Updated",
            estado_id: "State ID",
            estadoActual: "Current state",
            grupo_nombre: "Group name",
            nombres: "Responsible",
            apellido1: "First surname",
            apellido2: "Second surname",
            nombre_cliente: "Customer",
            documento: "Document",
            transicion_id: "Transition ID",
        });
    });
});

describe("useMassiveExecutionCasesTable - encabezados de la tabla de resultados", () => {
    it("toma las etiquetas de MASSIVE_EXECUTION_CASES_LABELS sin aplicar las exclusivas del filtro", () => {
        const { result } = renderHook(() => useMassiveExecutionCasesTable());
        const labels = Object.fromEntries(result.current.headers.map(({ column_name, label }) => [column_name, label]));

        expect(labels).toEqual({
            nivel1: "Level 1",
            created_at: "Created at",
            fecha_resolucion: "Resolution date",
            reference: "Consecutivo",
            updated_at: "Updated at",
            estadoActual: "Current state",
            nombres: "Responsible",
            nombreCliente: "Customer",
        });
    });
});
