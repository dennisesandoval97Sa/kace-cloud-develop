import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import CapacityTable from "./CapacityTable";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, opts) => opts?.defaultValue ?? key }),
}));

const groups = [
    {
        grupo_id: "g1",
        nombre: "Soporte N1",
        users_total: 7,
        users_available: 2,
        users_with_capacity: 2,
        capacidad: 5,
        max_cases_per_user: 4,
        assigned: 3,
        available_users: [
            { usuario_id: "u1", nombre: "Ana Pérez", with_capacity: true },
            { usuario_id: "u2", nombre: null, with_capacity: false },
        ],
        available_users_truncated: true,
    },
    {
        grupo_id: "g2",
        nombre: "Back Office",
        users_total: 3,
        users_available: 2,
        users_with_capacity: 0,
        capacidad: 0,
        max_cases_per_user: 4,
        assigned: 0,
    },
    {
        grupo_id: "g3",
        users_total: null,
        users_available: null,
        users_with_capacity: null,
        capacidad: null,
        max_cases_per_user: null,
        assigned: 1,
        work_queue: false,
    },
];

const renderedGroupNames = () =>
    screen
        .getAllByRole("row")
        .slice(1) // sin la fila de cabecera
        .map((row) => within(row).getAllByRole("cell")[0].textContent.replace(/^[▸▾]/, ""));

describe("CapacityTable", () => {
    it("filters rows by group name, case-insensitive", () => {
        render(<CapacityTable groups={groups} />);

        fireEvent.change(screen.getByTestId("capacity_group_filter"), { target: { value: "sopo" } });
        expect(renderedGroupNames()).toEqual(["Soporte N1"]);

        fireEvent.change(screen.getByTestId("capacity_group_filter"), { target: { value: "" } });
        expect(renderedGroupNames()).toHaveLength(3);
    });

    it("sorts by group name toggling asc/desc on header click", () => {
        render(<CapacityTable groups={groups} />);

        // g3 no tiene nombre: ordena por su id como fallback ("g3" < "soporte n1")
        fireEvent.click(screen.getByTestId("sort_name"));
        expect(renderedGroupNames()).toEqual(["Back Office", "g3", "Soporte N1"]);

        fireEvent.click(screen.getByTestId("sort_name"));
        expect(renderedGroupNames()).toEqual(["Soporte N1", "g3", "Back Office"]);
    });

    it("sorts numeric columns and keeps rows without data at the end", () => {
        render(<CapacityTable groups={groups} />);

        fireEvent.click(screen.getByTestId("sort_users_total"));
        expect(renderedGroupNames()).toEqual(["Back Office", "Soporte N1", "g3"]);

        fireEvent.click(screen.getByTestId("sort_users_total"));
        // Descendente: g3 (sin dato) sigue al final
        expect(renderedGroupNames()).toEqual(["Soporte N1", "Back Office", "g3"]);
    });

    it("expands a group to list its available users with their slot state", () => {
        render(<CapacityTable groups={groups} />);

        // Solo los grupos con usuarios disponibles tienen toggle
        expect(screen.queryByTestId("toggle_users_g2")).not.toBeInTheDocument();
        expect(screen.queryByTestId("users_row_g1")).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId("toggle_users_g1"));
        const usersRow = screen.getByTestId("users_row_g1");
        expect(within(usersRow).getByText(/Ana Pérez/)).toBeInTheDocument();
        // Sin nombre resuelto cae al id, con su estado de cupo
        expect(within(usersRow).getByText(/u2/)).toBeInTheDocument();
        expect(within(usersRow).getByText(/assignmentMonitor.detail.availableUsersTruncated/)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("toggle_users_g1"));
        expect(screen.queryByTestId("users_row_g1")).not.toBeInTheDocument();
    });

    it("explains numeric columns with a tooltip on the sortable header", () => {
        render(<CapacityTable groups={groups} />);
        expect(screen.getByTestId("sort_users_total")).toHaveAttribute(
            "title",
            "assignmentMonitor.tooltips.usersTotal",
        );
        expect(screen.getByTestId("sort_name")).not.toHaveAttribute("title");
    });

    it("keeps the header sticky inside its own scroll container", () => {
        render(<CapacityTable groups={groups} />);
        const header = screen.getAllByRole("rowgroup")[0]; // thead
        expect(header.className).toContain("sticky");
        expect(header.parentElement.parentElement.className).toContain("overflow-auto");
    });
});
