import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataTableFilterPresets from "./DataTableFilterPresets";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "app.text.savedFilters": "Filtros guardados",
                "app.text.filterName": "Nombre del filtro",
                "app.text.noResultsFound": "No se encontraron filtros",
                "app.text.deleteFilter": "Eliminar filtro",
                "app.text.confirmDeleteFilter": "¿Está seguro de eliminar este filtro?",
                "app.forms.cancel": "Cancelar",
            })[key] ?? key,
    }),
}));

describe("DataTableFilterPresets", () => {
    const savedFilterList = ["Filter1", "Filter2"];

    beforeEach(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });

    const confirmDeleteInAlert = async (user) => {
        expect(screen.getByTestId("filter_delete_alert")).toBeInTheDocument();
        await user.click(screen.getByTestId("filter_delete_alert_confirm"));
    };

    it("renders saved filters dropdown trigger and items", async () => {
        const user = userEvent.setup();
        const onFilterSelect = vi.fn();

        render(<DataTableFilterPresets savedFilterList={savedFilterList} onFilterSelect={onFilterSelect} />);

        const dropdownBtn = screen.getByTestId("dt_filter_dropdown");
        expect(dropdownBtn).toHaveTextContent("Filtros guardados");

        await user.click(dropdownBtn);
        expect(screen.getByTestId("dt_filter_Filter1")).toBeInTheDocument();
        expect(screen.getByTestId("dt_filter_Filter2")).toBeInTheDocument();
    });

    it("calls onFilterSelect and displays selected filter name", async () => {
        const user = userEvent.setup();
        const onFilterSelect = vi.fn();

        render(<DataTableFilterPresets savedFilterList={savedFilterList} onFilterSelect={onFilterSelect} />);

        await user.click(screen.getByTestId("dt_filter_dropdown"));
        await user.click(screen.getByTestId("dt_filter_Filter1"));

        expect(onFilterSelect).toHaveBeenCalledWith("Filter1");
        expect(screen.getByTestId("dt_filter_dropdown")).toHaveTextContent("Filter1");
    });

    it("calls onDeleteFilter after confirming AlertDialog", async () => {
        const user = userEvent.setup();
        const onDeleteFilter = vi.fn().mockResolvedValue(true);
        const onFilterSelect = vi.fn();

        render(
            <DataTableFilterPresets
                savedFilterList={savedFilterList}
                onFilterSelect={onFilterSelect}
                onDeleteFilter={onDeleteFilter}
            />,
        );

        await user.click(screen.getByTestId("dt_filter_dropdown"));
        expect(screen.getByTestId("dt_filter_delete_Filter1")).toBeInTheDocument();

        await user.click(screen.getByTestId("dt_filter_delete_Filter1"));
        await confirmDeleteInAlert(user);

        expect(onDeleteFilter).toHaveBeenCalledWith("Filter1");
        expect(onFilterSelect).not.toHaveBeenCalled();
    });

    it("clears selected filter badge when the deleted filter was selected", async () => {
        const user = userEvent.setup();
        const onDeleteFilter = vi.fn().mockResolvedValue(true);
        const onFilterSelect = vi.fn();

        render(
            <DataTableFilterPresets
                savedFilterList={savedFilterList}
                onFilterSelect={onFilterSelect}
                onDeleteFilter={onDeleteFilter}
                selectedFilter="Filter1"
            />,
        );

        expect(screen.getByTestId("dt_filter_dropdown")).toHaveTextContent("Filter1");

        await user.click(screen.getByTestId("dt_filter_dropdown"));
        await user.click(screen.getByTestId("dt_filter_delete_Filter1"));
        await confirmDeleteInAlert(user);

        expect(onDeleteFilter).toHaveBeenCalledWith("Filter1");
        expect(onFilterSelect).not.toHaveBeenCalled();
        expect(screen.getByTestId("dt_filter_dropdown")).toHaveTextContent("Filtros guardados");
    });

    it("does not delete when AlertDialog is cancelled", async () => {
        const user = userEvent.setup();
        const onDeleteFilter = vi.fn();
        const onFilterSelect = vi.fn();

        render(
            <DataTableFilterPresets
                savedFilterList={savedFilterList}
                onFilterSelect={onFilterSelect}
                onDeleteFilter={onDeleteFilter}
            />,
        );

        await user.click(screen.getByTestId("dt_filter_dropdown"));
        await user.click(screen.getByTestId("dt_filter_delete_Filter1"));

        expect(screen.getByTestId("filter_delete_alert")).toBeInTheDocument();
        await user.click(screen.getByTestId("filter_delete_alert_cancel"));

        expect(onDeleteFilter).not.toHaveBeenCalled();
        expect(onFilterSelect).not.toHaveBeenCalled();
    });

    it("allows keyboard focus and activation of the delete control with Enter", async () => {
        const user = userEvent.setup();
        const onDeleteFilter = vi.fn().mockResolvedValue(true);
        const onFilterSelect = vi.fn();

        render(
            <DataTableFilterPresets
                savedFilterList={savedFilterList}
                onFilterSelect={onFilterSelect}
                onDeleteFilter={onDeleteFilter}
            />,
        );

        await user.click(screen.getByTestId("dt_filter_dropdown"));
        const deleteButton = screen.getByTestId("dt_filter_delete_Filter1");
        deleteButton.focus();
        expect(deleteButton).toHaveFocus();

        await user.keyboard("{Enter}");
        expect(screen.getByTestId("filter_delete_alert")).toBeInTheDocument();
        await confirmDeleteInAlert(user);

        expect(onDeleteFilter).toHaveBeenCalledWith("Filter1");
        expect(onFilterSelect).not.toHaveBeenCalled();
    });

    it("filters both preset items and their delete buttons when searching", async () => {
        const user = userEvent.setup();
        const onDeleteFilter = vi.fn();
        const onFilterSelect = vi.fn();

        render(
            <DataTableFilterPresets
                savedFilterList={["Alpha Filter", "Beta Filter"]}
                onFilterSelect={onFilterSelect}
                onDeleteFilter={onDeleteFilter}
            />,
        );

        await user.click(screen.getByTestId("dt_filter_dropdown"));
        expect(screen.getByTestId("dt_filter_Alpha Filter")).toBeInTheDocument();
        expect(screen.getByTestId("dt_filter_delete_Alpha Filter")).toBeInTheDocument();
        expect(screen.getByTestId("dt_filter_Beta Filter")).toBeInTheDocument();
        expect(screen.getByTestId("dt_filter_delete_Beta Filter")).toBeInTheDocument();

        const input = screen.getByTestId("dt_filter_input");
        await user.type(input, "Alpha");

        expect(screen.getByTestId("dt_filter_Alpha Filter")).toBeInTheDocument();
        expect(screen.getByTestId("dt_filter_delete_Alpha Filter")).toBeInTheDocument();
        expect(screen.queryByTestId("dt_filter_Beta Filter")).not.toBeInTheDocument();
        expect(screen.queryByTestId("dt_filter_delete_Beta Filter")).not.toBeInTheDocument();

        await user.clear(input);
        await user.type(input, "NonExisting");

        expect(screen.queryByTestId("dt_filter_Alpha Filter")).not.toBeInTheDocument();
        expect(screen.queryByTestId("dt_filter_delete_Alpha Filter")).not.toBeInTheDocument();
        expect(screen.queryByTestId("dt_filter_Beta Filter")).not.toBeInTheDocument();
        expect(screen.queryByTestId("dt_filter_delete_Beta Filter")).not.toBeInTheDocument();
        expect(screen.getByTestId("dt_filter_empty")).toBeInTheDocument();
        expect(onFilterSelect).not.toHaveBeenCalled();
        expect(onDeleteFilter).not.toHaveBeenCalled();
    });

    it("deletes preset when search filter is active without selecting the filter", async () => {
        const user = userEvent.setup();
        const onDeleteFilter = vi.fn().mockResolvedValue(true);
        const onFilterSelect = vi.fn();

        render(
            <DataTableFilterPresets
                savedFilterList={["Alpha Filter", "Beta Filter"]}
                onFilterSelect={onFilterSelect}
                onDeleteFilter={onDeleteFilter}
            />,
        );

        await user.click(screen.getByTestId("dt_filter_dropdown"));
        const input = screen.getByTestId("dt_filter_input");
        await user.type(input, "Alpha");

        await user.click(screen.getByTestId("dt_filter_delete_Alpha Filter"));
        await confirmDeleteInAlert(user);

        expect(onDeleteFilter).toHaveBeenCalledWith("Alpha Filter");
        expect(onFilterSelect).not.toHaveBeenCalled();
    });
});
