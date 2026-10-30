import { Fragment } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
import { SelectByProvider as RealSelectByProvider } from "@/components/ui-shared/src/components/SelectByProvider";
import { Select } from "@/components/ui-shared/src/components/Select/Select";
import { InputForm, DatePicker } from "@kace/ui-shared";
import { MultiSelectClientForm } from "../../../../../../components/core/multiselector/MultiSelectClientForm";
import FieldInput from "./components/FieldInput";
import { NaturalPersonFields } from "./components/NaturalPersonFields";
import { SelectLiterals } from "./components/SelectLiterals";
import { TypeClientComponent } from "./components/TypeClientComponent";
import { ClientForm } from "./ClientForm";

const state = vi.hoisted(() => ({ agentContext: null, lockedFields: new Set() }));

vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("@/components/ui-shared/src/components/Select/Select", () => ({ Select: vi.fn(() => null) }));
vi.mock("@/services/genericSearch", () => ({ genericSearch: vi.fn() }));
vi.mock("@/hooks/useSelectByProviderQuery", () => ({ default: vi.fn() }));
vi.mock("@kace/ui-shared", () => ({
    InputForm: vi.fn(() => null),
    DatePicker: vi.fn(() => null),
    KField: Fragment,
    // The real component, so the test sees how this consumer pages its options.
    SelectByProvider: (props) => RealSelectByProvider(props),
}));
vi.mock("@kace/utils", () => ({
    joiFormikAdapter: () => undefined,
    TYPE_DOCUMENT: { NIT: "NIT", CC: "CC" },
    TYPE_CUSTOMER: { COMMERCIAL: "Comercial", NATURAL: "Natural" },
}));
vi.mock("../../../../../../schemas/ClientSchema", () => ({ ClientCreateSchemaForm: {} }));
vi.mock("../../../../context/AgentContext", () => ({ useAgentContext: () => state.agentContext }));
vi.mock("../../hooks/useAgentFormEditConfig", () => ({
    default: () => ({ validateFieldsEdit: (field) => state.lockedFields.has(field) }),
}));
vi.mock("../../hooks/useClientsManagement", () => ({
    default: () => ({ handleUsers: vi.fn(), dataLiterals: [], handleSetLiteral: vi.fn() }),
}));
vi.mock("../../hooks/useSaveClient", () => ({ default: () => ({ saveClient: vi.fn() }) }));
vi.mock("../../../../hooks/useAgentFormConfig", () => ({ default: () => ({ clientSchemaForm: {} }) }));
vi.mock("../../../../hooks/useAgentFormCopyConfig", () => ({
    default: () => ({ validateFieldsCopyPaste: () => undefined }),
}));
vi.mock("../../../../../../components/core/multiselector/MultiSelectClientForm", () => ({
    MultiSelectClientForm: vi.fn(() => null),
}));
vi.mock("./components/FieldInput", () => ({ default: vi.fn(() => null) }));
vi.mock("./components/NaturalPersonFields", () => ({ NaturalPersonFields: vi.fn(() => null) }));
vi.mock("./components/SelectLiterals", () => ({ SelectLiterals: vi.fn(() => null) }));
vi.mock("./components/TypeClientComponent", () => ({ TypeClientComponent: vi.fn(() => null) }));

const PAGE_SIZE = 20;
const companiesPage = (page) =>
    Array.from({ length: PAGE_SIZE }, (_, index) => ({ id: `p${page}-${index}`, nombres: `Empresa ${page}-${index}` }));
// React Query returns the same result object until the data changes; a fresh one per render would loop.
const queryResults = [0, 1].map((page) => ({ data: { data: companiesPage(page) }, isLoading: false }));
const pendingResult = { isLoading: true };

const OPTIONAL_FIELD_INPUTS = [
    "documento",
    "email",
    "email_alterno",
    "telefono",
    "telefono_alterno",
    "sexo",
    "estado_civil",
    "campos_extra1",
    "campos_extra2",
    "campos_extra3",
];

const renderClientForm = ({ tipoDocumento = "CC", fields = {}, lockedFields = [] } = {}) => {
    state.lockedFields = new Set(lockedFields);
    state.agentContext = {
        clientId: "client-1",
        isNewClient: false,
        dataUserSelected: { tipo_documento: tipoDocumento },
        configAgent: { AgentNameFields: { clients: {} }, clients: { fields, custom_form_id: "" } },
    };
    return render(<ClientForm />);
};

const lastPropsOf = (component) => component.mock.calls.at(-1)?.[0];
const renderedNames = (component) => [...new Set(component.mock.calls.map(([props]) => props.name))];
const companySelectProps = () => Select.mock.calls.filter(([props]) => props.name === "padre_id").at(-1)?.[0];

describe("ClientForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useQuery).mockImplementation(({ queryKey }) => queryResults[queryKey[2]] ?? pendingResult);
    });

    it("always renders the client type selector", () => {
        renderClientForm();

        expect(lastPropsOf(TypeClientComponent)).toEqual(expect.objectContaining({ value: "CC" }));
    });

    describe("tipo_documento", () => {
        it("is not rendered when the field is disabled in the configuration", () => {
            renderClientForm();

            expect(SelectLiterals).not.toHaveBeenCalled();
            expect(renderedNames(InputForm)).not.toContain("tipo_documento");
        });

        it("is a literal select when it can be edited", () => {
            renderClientForm({ fields: { field_tipo_documento: true } });

            expect(lastPropsOf(SelectLiterals)).toEqual(
                expect.objectContaining({ name: "tipo_documento", value: "CC" }),
            );
            expect(renderedNames(InputForm)).not.toContain("tipo_documento");
        });

        it("is a disabled text input when it cannot be edited", () => {
            renderClientForm({ fields: { field_tipo_documento: true }, lockedFields: ["tipo_documento"] });

            const input = InputForm.mock.calls.map(([props]) => props).find(({ name }) => name === "tipo_documento");
            expect(input).toEqual(expect.objectContaining({ disabled: true }));
            expect(SelectLiterals).not.toHaveBeenCalled();
        });
    });

    describe("client name", () => {
        it("asks for the natural person fields when the client is not a company", () => {
            renderClientForm({ tipoDocumento: "CC" });

            expect(NaturalPersonFields).toHaveBeenCalled();
            expect(renderedNames(InputForm)).not.toContain("nombre_empresa");
        });

        it("asks for the company name when the client is a NIT", () => {
            renderClientForm({ tipoDocumento: "NIT" });

            expect(renderedNames(InputForm)).toContain("nombre_empresa");
            expect(NaturalPersonFields).not.toHaveBeenCalled();
        });
    });

    describe("optional fields", () => {
        it.each(OPTIONAL_FIELD_INPUTS)("renders %s only when it is enabled in the configuration", (name) => {
            renderClientForm({ fields: { [`field_${name}`]: true } });

            expect(renderedNames(FieldInput)).toEqual([name]);
        });

        it("renders none of them when none is enabled", () => {
            renderClientForm();

            expect(FieldInput).not.toHaveBeenCalled();
            expect(DatePicker).not.toHaveBeenCalled();
        });

        it("renders the birth date picker when fecha_nacimiento is enabled", () => {
            renderClientForm({ fields: { field_fecha_nacimiento: true }, lockedFields: ["fecha_nacimiento"] });

            expect(lastPropsOf(DatePicker)).toEqual(expect.objectContaining({ disabled: true }));
        });
    });

    describe("Empresa (padre_id)", () => {
        it("keeps the companies of the first page when the select loads the next one", () => {
            renderClientForm({ tipoDocumento: "CC" });
            const optionValues = () => companySelectProps().options.map(({ value }) => value);

            expect(optionValues()).toEqual(companiesPage(0).map(({ id }) => id));

            act(() => companySelectProps().fetchNextPage());

            expect(optionValues()).toEqual([...companiesPage(0), ...companiesPage(1)].map(({ id }) => id));
        });

        it("labels each company with its nombres", () => {
            renderClientForm({ tipoDocumento: "CC" });

            expect(companySelectProps().options[0]).toEqual({ value: "p0-0", label: "Empresa 0-0" });
        });

        it("shows the users multiselect instead of the company select for a NIT client", () => {
            renderClientForm({ tipoDocumento: "NIT" });

            expect(companySelectProps()).toBeUndefined();
            expect(MultiSelectClientForm).toHaveBeenCalled();
        });
    });
});
