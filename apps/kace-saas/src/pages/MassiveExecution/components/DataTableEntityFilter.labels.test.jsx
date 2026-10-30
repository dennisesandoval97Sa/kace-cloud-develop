import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import i18n from "@/locale/i18n";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

/*
 * Columnas de `clients` tal como las entrega /schema-fields (label desde LABELS del backend).
 * Las columnas excluidas por MassiveExecutionClientTab no se incluyen.
 */
const CLIENTS_SCHEMA = [
    { column_name: "tipo_cliente", data_type: "String", label: "Client type" },
    { column_name: "tipo_documento", data_type: "String", label: "Document type" },
    { column_name: "documento", data_type: "String", label: "Document" },
    { column_name: "nombres", data_type: "String", label: "First names" },
    { column_name: "apellido1", data_type: "String", label: "First surname" },
    { column_name: "apellido2", data_type: "String", label: "Second surname" },
    { column_name: "nombre_empresa", data_type: "String", label: "Company name" },
    { column_name: "sexo", data_type: "String", label: "Gender" },
    { column_name: "estado_civil", data_type: "String", label: "Marital status" },
    { column_name: "fecha_nacimiento", data_type: "date", label: "Birth date" },
    { column_name: "email", data_type: "String", label: "Email" },
    { column_name: "email_alterno", data_type: "String", label: "Alternate email" },
    { column_name: "telefono", data_type: "String", label: "Phone" },
    { column_name: "telefono_alterno", data_type: "String", label: "Alternate phone" },
    { column_name: "campos_extra1", data_type: "String", label: "Extra fields 1" },
    { column_name: "campos_extra2", data_type: "String", label: "Extra fields 2" },
    { column_name: "campos_extra3", data_type: "String", label: "Extra fields 3" },
    { column_name: "padre_id", data_type: "String", label: "Parent ID" },
    { column_name: "habeas_data", data_type: "String", label: "Habeas Data" },
];

let mockSchema = CLIENTS_SCHEMA;

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({
        getSchemaField: (entity) => {
            if (entity !== URL_AND_KEYS.clients.entity) throw new Error(`Entidad inesperada: ${entity}`);
            return mockSchema;
        },
    }),
}));
vi.mock("@/components/ui-shared", () => ({
    Button: (props) => <button {...props} />,
}));
vi.mock("@/componentsV2/core/DataTable/components/DataTableFilterInputs", () => ({
    default: ({ label, name }) => <span data-testid={`label-${name}`}>{label}</span>,
}));

const { default: DataTableEntityFilter } = await import("./DataTableEntityFilter");

const renderLabels = async (language) => {
    await act(() => i18n.changeLanguage(language));
    render(<DataTableEntityFilter />);
    return Object.fromEntries(
        mockSchema.map(({ column_name }) => [column_name, screen.getByTestId(`label-${column_name}`).textContent]),
    );
};

describe("DataTableEntityFilter - etiquetas del filtro por cliente", () => {
    afterEach(async () => {
        mockSchema = CLIENTS_SCHEMA;
        await act(() => i18n.changeLanguage("es"));
    });

    it("traduce todos los campos del cliente en español", async () => {
        expect(await renderLabels("es")).toEqual({
            tipo_cliente: "Tipo de cliente",
            tipo_documento: "Tipo de documento",
            documento: "Documento",
            nombres: "Nombres",
            apellido1: "Primer apellido",
            apellido2: "Segundo apellido",
            nombre_empresa: "Nombre de la empresa",
            sexo: "Sexo",
            estado_civil: "Estado civil",
            fecha_nacimiento: "Fecha de nacimiento",
            email: "Correo electrónico",
            email_alterno: "Correo alternativo",
            telefono: "Teléfono",
            telefono_alterno: "Teléfono alternativo",
            campos_extra1: "Campos extra 1",
            campos_extra2: "Campos extra 2",
            campos_extra3: "Campos extra 3",
            padre_id: "ID del padre",
            habeas_data: "Habeas Data",
        });
    });

    it("traduce todos los campos del cliente en inglés", async () => {
        expect(await renderLabels("en")).toEqual({
            tipo_cliente: "Client type",
            tipo_documento: "Document type",
            documento: "Document",
            nombres: "First names",
            apellido1: "First surname",
            apellido2: "Second surname",
            nombre_empresa: "Company name",
            sexo: "Gender",
            estado_civil: "Marital status",
            fecha_nacimiento: "Birth date",
            email: "Email",
            email_alterno: "Alternate email",
            telefono: "Phone",
            telefono_alterno: "Alternate phone",
            campos_extra1: "Extra fields 1",
            campos_extra2: "Extra fields 2",
            campos_extra3: "Extra fields 3",
            padre_id: "Parent ID",
            habeas_data: "Habeas Data",
        });
    });

    it("usa Title Case de la columna cuando no existe la clave fieldsClient", async () => {
        mockSchema = [{ column_name: "canal_preferido", data_type: "String", label: "undefined" }];

        expect(await renderLabels("en")).toEqual({ canal_preferido: "Canal Preferido" });
    });
});
