import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CellGroups from "./CellGroups";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (_key, fallback) => fallback }),
}));

const makeRow = (data) => ({ original: data });

describe("CellGroups", () => {
    it("usa label cuando no hay nombre y el accessorKey de tablero", () => {
        render(
            <CellGroups
                accessorKey="access_users"
                row={makeRow({
                    access_users: [{ id: "u1", label: "Ana Pérez" }],
                    groups: [{ id: "g1", nombre: "Admin" }],
                })}
            />,
        );
        expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
        expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    });

    it("muestra raya si la coleccion no es un array o esta vacia", () => {
        const { rerender } = render(<CellGroups row={makeRow({ groups: [] })} />);
        expect(screen.getByText("—")).toBeInTheDocument();

        rerender(<CellGroups row={makeRow({ groups: "no-array" })} />);
        expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("abre el detalle con titulo de usuarios y aria-label contextual", async () => {
        const user = userEvent.setup();
        render(
            <CellGroups
                accessorKey="access_users"
                row={makeRow({
                    access_users: [
                        { id: "u1", label: "Ana" },
                        { id: "u2", label: "Bruno" },
                        { id: "u3", label: "Carla" },
                    ],
                })}
            />,
        );
        const trigger = screen.getByRole("button", { name: "+1 Usuarios" });
        await user.click(trigger);
        expect(screen.getByText("Usuarios")).toBeInTheDocument();
        expect(screen.getByText("Carla")).toBeInTheDocument();
    });
});
