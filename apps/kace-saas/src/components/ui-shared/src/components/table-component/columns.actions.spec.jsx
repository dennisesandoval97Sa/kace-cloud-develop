import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createColumns } from "./columns";

const TRANSLATIONS = {
    es: { "app.forms.delete": "Eliminar" },
    en: { "app.forms.delete": "Delete" },
};
let language = "es";

vi.mock("i18next", () => ({
    t: (key) => TRANSLATIONS[language][key] ?? key,
}));

vi.mock("../alert-modal", () => ({
    AlertModalShared: ({ buttonAction }) => <div data-testid="delete-confirmation">{buttonAction}</div>,
}));

const ActionsCell = ({ name }) => {
    const [actionsColumn] = createColumns([], true, [], [{ name, action: vi.fn(), customizable: false }]);
    return actionsColumn.cell({ row: { original: { id: "row-1" } } });
};

const openActions = async (name) => {
    const user = userEvent.setup();
    render(
        <QueryClientProvider client={new QueryClient()}>
            <ActionsCell name={name} />
        </QueryClientProvider>,
    );
    await user.click(screen.getByTestId("btn_open_actions_table_row-1"));
};

describe("createColumns - confirmación de la acción de borrado", () => {
    afterEach(() => {
        language = "es";
    });

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
