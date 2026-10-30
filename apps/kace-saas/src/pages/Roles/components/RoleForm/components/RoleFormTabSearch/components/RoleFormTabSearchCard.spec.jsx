import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RoleFormTabSearchCard from "./RoleFormTabSearchCard";

const buildModule = (granted) => ({
    id: "event-logs",
    name: "Registros de eventos",
    selected: granted ? 1 : 0,
    permissions: [
        {
            module_id: "event-logs",
            name: "EventLogsSearchAdvanced",
            description: "Use advanced search filters on event-logs.search",
            label: "Usar filtros de búsqueda avanzada en event-logs.search",
            granted,
        },
    ],
});

describe("RoleFormTabSearchCard", () => {
    it("shows the translated label instead of the backend description", () => {
        render(<RoleFormTabSearchCard module={buildModule(true)} />);

        const label = screen.getByTestId("label_permission_event-logs_0");
        expect(label).toHaveTextContent("Usar filtros de búsqueda avanzada en event-logs.search");
        expect(label).toHaveAttribute("title", "Usar filtros de búsqueda avanzada en event-logs.search");
        expect(screen.queryByText("Use advanced search filters on event-logs.search")).not.toBeInTheDocument();
    });

    it("shows the module name and the selected permissions count", () => {
        render(<RoleFormTabSearchCard module={buildModule(true)} />);

        expect(screen.getByRole("heading", { name: "Registros de eventos" })).toBeInTheDocument();
        expect(screen.getByTestId("role_form_search_card_badge_1")).toHaveTextContent("1/1");
    });

    it("switches the badge variant depending on whether any permission is selected", () => {
        const { unmount } = render(<RoleFormTabSearchCard module={buildModule(true)} />);
        const selectedClass = screen.getByTestId("role_form_search_card_badge_1").className;
        unmount();

        render(<RoleFormTabSearchCard module={buildModule(false)} />);
        const unselectedBadge = screen.getByTestId("role_form_search_card_badge_0");

        expect(unselectedBadge).toHaveTextContent("0/1");
        expect(unselectedBadge.className).not.toBe(selectedClass);
    });

    it("reflects the granted state in the checkbox and reports the toggled module and permission", () => {
        const handlePermissionToggle = vi.fn();
        render(<RoleFormTabSearchCard module={buildModule(false)} handlePermissionToggle={handlePermissionToggle} />);

        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).not.toBeChecked();

        fireEvent.click(checkbox);
        expect(handlePermissionToggle).toHaveBeenCalledWith("event-logs", "EventLogsSearchAdvanced");
    });

    it("selects and clears every permission of the module", () => {
        const handleModuleSelectAll = vi.fn();
        render(<RoleFormTabSearchCard module={buildModule(false)} handleModuleSelectAll={handleModuleSelectAll} />);

        fireEvent.click(screen.getByTestId("btn_role_all"));
        fireEvent.click(screen.getByTestId("btn_role_none"));

        expect(handleModuleSelectAll.mock.calls).toEqual([
            ["event-logs", true],
            ["event-logs", false],
        ]);
    });
});
