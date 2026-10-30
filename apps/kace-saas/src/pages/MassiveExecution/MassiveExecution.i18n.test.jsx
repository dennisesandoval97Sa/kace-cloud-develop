import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/locale/i18n";

vi.mock("./components/MassiveExecutionClientTab", () => ({ default: () => null }));
vi.mock("./components/MassiveExecutionCasesFilterForm", () => ({ default: () => null }));
vi.mock("./components/MassiveExecutionCasesFileUploadForm", () => ({ default: () => null }));
vi.mock("./components/MassiveExecutionClientsFileUploadForm", () => ({ default: () => null }));
vi.mock("./components/MassiveExecutionPreviewTableContainer", () => ({ default: () => null }));
vi.mock("./components/AuxClientsFilterPreviewDataTable", () => ({ default: () => null }));
vi.mock("@/pages/MassiveExecution/hooks/useMassiveExecutionClients", () => ({
    default: () => ({
        loading: false,
        clientRoutesOptions: {
            routes: [{ id: "r1", label: "datos" }],
            fields: [{ id: "f1", label: "ciudad", routeId: "r1" }],
        },
    }),
}));

const { default: MassiveExecutionExecute } = await import("./MassiveExecutionExecute");
const { default: MassiveExecutionAuxClient } = await import("./components/MassiveExecutionAuxClient");

const renderExecute = () =>
    render(
        <MemoryRouter>
            <MassiveExecutionExecute />
        </MemoryRouter>,
    );

const useLanguage = (language) => act(() => i18n.changeLanguage(language));

describe("Massive Execution - textos fijos traducidos", () => {
    beforeAll(() => {
        // jsdom no implementa scrollIntoView, que usa el listado del Command.
        Element.prototype.scrollIntoView = vi.fn();
    });

    afterEach(async () => {
        await useLanguage("es");
    });

    it("traduce el encabezado de búsqueda y las pestañas", async () => {
        await useLanguage("en");
        renderExecute();

        expect(screen.getByText("Search")).toBeInTheDocument();
        expect(screen.getByText("Select a search type")).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Filter by client" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Filter by case" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Upload cases file" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Upload clients file" })).toBeInTheDocument();
    });

    it("traduce los textos del filtro por Auxiliar de Cliente", async () => {
        await useLanguage("en");
        render(<MassiveExecutionAuxClient onChange={vi.fn()} />);

        expect(screen.getByText("Route")).toBeInTheDocument();
        fireEvent.click(screen.getByText("Select an option"));
        expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
        fireEvent.click(screen.getByText("datos"));

        expect(screen.getByText("Field")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Value to search...")).toBeInTheDocument();
        fireEvent.click(screen.getByText("Select an option"));
        fireEvent.click(screen.getByText("ciudad"));
        fireEvent.change(screen.getByPlaceholderText("Value to search..."), { target: { value: "Bogota" } });
        fireEvent.click(screen.getByRole("button", { name: "Add" }));

        expect(screen.getByText("Active filters:")).toBeInTheDocument();
    });

    it("mantiene los textos en español", async () => {
        renderExecute();

        expect(screen.getByText("Búsqueda")).toBeInTheDocument();
        expect(screen.getByText("Seleccione un tipo de búsqueda")).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Filtro por cliente" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Cargar archivo clientes" })).toBeInTheDocument();
    });

    it("identifica las pestañas por su value, sin espacios ni dependencia del idioma", () => {
        renderExecute();

        ["clients", "filter", "file", "file_clients"].forEach((value) => {
            expect
                .soft(screen.queryByTestId(`massive_execution_tabs_${value}`))
                .toHaveAttribute("id", `massive_execution_tabs_${value}`);
        });
    });
});
