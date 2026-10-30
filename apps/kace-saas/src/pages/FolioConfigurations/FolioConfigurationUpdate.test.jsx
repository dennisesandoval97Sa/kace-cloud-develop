import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "@/locale/i18n";
import useGenericViewQuery from "@kace/hooks/useGenericViewQuery";
import { FolioConfigurationUpdate, normalizeConfiguration } from "./FolioConfigurationUpdate";

const formProps = vi.fn();
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@kace/hooks/useGenericViewQuery", () => ({ default: vi.fn() }));
vi.mock("@kace/hooks/useGeneralMutation", () => ({ default: () => ({ mutate, isPending: false }) }));
vi.mock("@kace/ui-shared", async (importOriginal) => ({
    ...(await importOriginal()),
    GeneralLoader: () => <div data-testid="general_loader" />,
}));
vi.mock("./components/FolioConfigurationForm", () => ({
    FolioConfigurationForm: (props) => {
        formProps(props);
        return <div data-testid="folio_configuration_form" />;
    },
}));

const ID = "11111111-1111-4111-8111-111111111111";

const renderAt = (path) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/folio-configurations/create" element={<FolioConfigurationUpdate />} />
                <Route path="/folio-configurations/update/:id" element={<FolioConfigurationUpdate />} />
            </Routes>
        </MemoryRouter>,
    );

const queryState = (state) =>
    vi.mocked(useGenericViewQuery).mockReturnValue({ isLoading: false, isError: false, ...state });

describe("normalizeConfiguration", () => {
    it("deja segments como lista y los escalares nulos como cadena vacía", () => {
        expect(normalizeConfiguration({ id: ID, descripcion: null, segments: null, start_value: 1 })).toEqual({
            id: ID,
            descripcion: "",
            segments: [],
            start_value: 1,
        });
    });
});

describe("FolioConfigurationUpdate", () => {
    beforeEach(() => {
        formProps.mockClear();
        vi.mocked(useGenericViewQuery).mockReset();
    });

    it("en alta no consulta nada y monta el formulario vacío", () => {
        queryState({ data: undefined });

        renderAt("/folio-configurations/create");

        expect(useGenericViewQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
        expect(screen.getByTestId("folio_configuration_form")).toBeInTheDocument();
        expect(formProps.mock.calls.at(-1)[0].data).toBeNull();
    });

    // Sin id el form haría POST: guardar durante la carga crearía una configuración duplicada.
    it("mientras carga una configuración existente no ofrece el formulario", () => {
        queryState({ data: undefined, isLoading: true });

        renderAt(`/folio-configurations/update/${ID}`);

        expect(screen.getByTestId("general_loader")).toBeInTheDocument();
        expect(screen.queryByTestId("folio_configuration_form")).not.toBeInTheDocument();
    });

    it("si la carga falla avisa en vez de mostrar un formulario de alta", () => {
        queryState({ data: undefined, isError: true });

        renderAt(`/folio-configurations/update/${ID}`);

        expect(screen.getByRole("alert")).toHaveTextContent(i18n.t("folioConfigurations.messages.loadError"));
        expect(screen.queryByTestId("folio_configuration_form")).not.toBeInTheDocument();
    });

    it("pasa al formulario la configuración normalizada", () => {
        queryState({ data: { id: ID, nombre: "Radicado", descripcion: null, segments: null } });

        renderAt(`/folio-configurations/update/${ID}`);

        expect(useGenericViewQuery).toHaveBeenCalledWith(
            expect.objectContaining({ url: `/folio-configurations/${ID}`, searchById: [ID], enabled: true }),
        );
        expect(formProps.mock.calls.at(-1)[0].data).toEqual({
            id: ID,
            nombre: "Radicado",
            descripcion: "",
            segments: [],
        });
    });

    it("al guardar envía la descripción vaciada para que el API la borre", () => {
        queryState({ data: { id: ID, nombre: "Radicado", descripcion: "Antes", segments: [] } });
        renderAt(`/folio-configurations/update/${ID}`);

        const { dataHandler } = formProps.mock.calls.at(-1)[0];
        dataHandler({ id: ID, nombre: "Radicado", descripcion: "", segments: [{ type: "sequence", length: 4 }] });

        expect(mutate).toHaveBeenCalledWith(
            expect.objectContaining({
                url: `/folio-configurations/${ID}`,
                dataPost: expect.objectContaining({ descripcion: "" }),
            }),
        );
    });
});
