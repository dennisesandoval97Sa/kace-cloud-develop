import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTableBulkActions from "./DataTableBulkActions";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "navbar.actions": "Acciones",
                "button.clearSelection": "Limpiar seleccion",
            })[key] ?? key,
    }),
}));

describe("DataTableBulkActions", () => {
    it("does not render when no rows are selected", () => {
        render(
            <DataTableBulkActions
                bulkActions={{
                    selectedCount: 0,
                    onClearSelection: vi.fn(),
                    actions: [{ label: "Mover interacciones", onClick: vi.fn() }],
                }}
            />,
        );

        expect(screen.queryByRole("button", { name: /Acciones/i })).not.toBeInTheDocument();
    });

    it("opens the configured bulk actions when rows are selected", async () => {
        const user = userEvent.setup();
        const moveAction = vi.fn();
        const closeAction = vi.fn();
        const deleteAction = vi.fn();

        render(
            <DataTableBulkActions
                bulkActions={{
                    selectedCount: 2,
                    onClearSelection: vi.fn(),
                    actions: [
                        { label: "Mover interacciones", onClick: moveAction },
                        { label: "Cerrar interacciones", onClick: closeAction },
                        { label: "Eliminar interacciones", onClick: deleteAction },
                    ],
                }}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Acciones (2)" }));

        expect(screen.getByRole("menuitem", { name: "Mover interacciones" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Cerrar interacciones" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Eliminar interacciones" })).toBeInTheDocument();

        await user.click(screen.getByRole("menuitem", { name: "Mover interacciones" }));

        expect(moveAction).toHaveBeenCalledTimes(1);
        expect(closeAction).not.toHaveBeenCalled();
        expect(deleteAction).not.toHaveBeenCalled();
    });

    it("routes clear selection to the configured handler", async () => {
        const user = userEvent.setup();
        const onClearSelection = vi.fn();

        render(
            <DataTableBulkActions
                bulkActions={{
                    selectedCount: 3,
                    onClearSelection,
                    actions: [{ label: "Mover interacciones", onClick: vi.fn() }],
                }}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Acciones (3)" }));
        await user.click(screen.getByRole("menuitem", { name: "Limpiar seleccion" }));

        expect(onClearSelection).toHaveBeenCalledTimes(1);
    });
});
