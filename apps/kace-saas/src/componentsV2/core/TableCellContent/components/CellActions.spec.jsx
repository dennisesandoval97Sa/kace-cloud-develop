import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CellActions from "./CellActions";

const TRANSLATIONS = {
    es: { "gridMain.actions.actions": "Acciones", "app.forms.delete": "Eliminar", "app.forms.cancel": "Cancelar" },
    en: { "gridMain.actions.actions": "Actions", "app.forms.delete": "Delete", "app.forms.cancel": "Cancel" },
};
let language = "es";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => TRANSLATIONS[language][key] ?? key }),
}));

vi.mock("@/components/ui-shared", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        AlertModalShared: ({ handleAcceptAction, buttonAction }) => (
            <button type="button" data-testid="delete-confirmation" onClick={handleAcceptAction}>
                {buttonAction}
            </button>
        ),
    };
});

const renderCellActions = (props) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <CellActions {...props} />
        </QueryClientProvider>,
    );
};

describe("CellActions", () => {
    it("passes the full row data as the third argument to non-delete actions", async () => {
        const user = userEvent.setup();
        const action = vi.fn();
        const workspace = {
            id: "workspace-id",
            reference: "workspace-reference",
            tag_creation_flow_id: "flow-id",
        };

        renderCellActions({
            row: { original: workspace },
            arrayActions: [{ name: "Register Tags", action }],
        });

        await user.click(screen.getByTestId("btn_cell_actions_workspace-id"));
        await user.click(screen.getByText("Register Tags"));

        expect(action).toHaveBeenCalledWith("workspace-id", "workspace-reference", workspace);
    });

    it("no renderiza una accion con show false", async () => {
        const user = userEvent.setup();
        renderCellActions({
            row: { original: { id: "row-1", reference: "ref-1" } },
            arrayActions: [
                { name: "Oculta", action: vi.fn(), show: () => false },
                { name: "Visible", action: vi.fn() },
            ],
        });

        await user.click(screen.getByTestId("btn_cell_actions_row-1"));
        expect(screen.queryByText("Oculta")).not.toBeInTheDocument();
        expect(screen.getByText("Visible")).toBeInTheDocument();
    });

    it("pasa la misma aridad en la ruta de borrado", async () => {
        const user = userEvent.setup();
        const action = vi.fn();
        const board = { id: "board-1", reference: "B-1" };

        renderCellActions({
            row: { original: board },
            arrayActions: [{ name: "Eliminar", action }],
        });

        await user.click(screen.getByTestId("btn_cell_actions_board-1"));
        await user.click(screen.getByText("Eliminar"));

        expect(action).toHaveBeenCalledWith("board-1", "B-1", board);
    });

    describe("confirmación de la acción de borrado", () => {
        afterEach(() => {
            language = "es";
        });

        const openActions = async (name) => {
            const user = userEvent.setup();
            renderCellActions({ row: { original: { id: "row-1" } }, arrayActions: [{ name, action: vi.fn() }] });
            await user.click(screen.getByTestId("btn_cell_actions_row-1"));
        };

        it.each([
            ["es", "Eliminar"],
            ["en", "Delete"],
            ["en", "Eliminar"],
            ["es", "Delete"],
        ])("en %s pide confirmación para la acción %s", async (lang, name) => {
            language = lang;
            await openActions(name);

            expect(screen.getByTestId("delete-confirmation")).toHaveTextContent(name);
        });

        it("no pide confirmación para una acción que no es de borrado", async () => {
            language = "en";
            await openActions("Edit");

            expect(screen.queryByTestId("delete-confirmation")).not.toBeInTheDocument();
        });
    });
});
