import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import DataTableFilters from "./DataTableFilters";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "button.clearFilters": "Limpiar filtros",
                "app.forms.active": "Activo",
                "app.forms.inactive": "Inactivo",
            })[key] ?? key,
    }),
}));

describe("DataTableFilters", () => {
    it("shows list filter option labels in active chips", () => {
        render(
            <DataTableFilters
                schema={[
                    {
                        column_name: "status",
                        header: "Estado",
                        data_type: SPECIAL_FIELDS.list,
                        filterData: {
                            field: "status",
                            operator: "eq",
                            type: "AND",
                        },
                        options: [{ value: "In review", name: "En revisión" }],
                    },
                ]}
                onApply={vi.fn()}
                onClear={vi.fn()}
                onFilterSelect={vi.fn()}
                savedFilterList={[]}
                isFiltered
                currentFiltersValues={{
                    status: {
                        field: "status",
                        operator: "eq",
                        type: "AND",
                        value: "In review",
                    },
                }}
            />,
        );

        const chips = within(screen.getByTestId("dt_filter_chips"));
        expect(chips.getByText("Estado")).toBeInTheDocument();
        expect(chips.getByText("En revisión")).toBeInTheDocument();
        expect(chips.queryByText("In review")).not.toBeInTheDocument();
    });

    it("shows translated switch-state labels in active chips", () => {
        render(
            <DataTableFilters
                schema={[
                    {
                        column_name: "is_active",
                        header: "Estado",
                        data_type: SPECIAL_FIELDS.switch_state,
                        filterData: {
                            field: "is_active",
                            operator: "eq",
                            type: "AND",
                        },
                    },
                ]}
                onApply={vi.fn()}
                onClear={vi.fn()}
                onFilterSelect={vi.fn()}
                savedFilterList={[]}
                isFiltered
                currentFiltersValues={{
                    is_active: {
                        field: "is_active",
                        operator: "eq",
                        type: "AND",
                        value: true,
                    },
                }}
            />,
        );

        const chips = within(screen.getByTestId("dt_filter_chips"));
        expect(chips.getByText("Estado")).toBeInTheDocument();
        expect(chips.getByText("Activo")).toBeInTheDocument();
        expect(chips.queryByText("true")).not.toBeInTheDocument();
    });

    it("delegates clear to onClear without resetting the local page size", () => {
        const onClear = vi.fn();

        render(
            <DataTableFilters
                schema={[]}
                onApply={vi.fn()}
                onClear={onClear}
                onFilterSelect={vi.fn()}
                savedFilterList={[]}
                isFiltered
                pageSize={75}
                currentFiltersValues={{}}
            />,
        );

        fireEvent.click(screen.getByTestId("dt_filter_clear"));
        expect(onClear).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByTestId("dt_filter"));
        expect(document.getElementById("pageSize")).toHaveValue("75");
    });

    it("renders the clear button for a Dashboard drill-in even without user filters", () => {
        const onClear = vi.fn();

        render(
            <DataTableFilters
                schema={[]}
                onApply={vi.fn()}
                onClear={onClear}
                onFilterSelect={vi.fn()}
                savedFilterList={[]}
                isFiltered={false}
                hasClearableBaseFilters
                currentFiltersValues={{}}
            />,
        );

        expect(screen.queryByTestId("dt_filter_chips")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("dt_filter_clear"));
        expect(onClear).toHaveBeenCalledTimes(1);
    });

    it("hides the clear button when neither user filters nor base filters are active", () => {
        render(
            <DataTableFilters
                schema={[]}
                onApply={vi.fn()}
                onClear={vi.fn()}
                onFilterSelect={vi.fn()}
                savedFilterList={[]}
                isFiltered={false}
                hasClearableBaseFilters={false}
                currentFiltersValues={{}}
            />,
        );

        expect(screen.queryByTestId("dt_filter_clear")).not.toBeInTheDocument();
    });

    it("discards an unconfirmed page size when the dialog is closed without searching", async () => {
        const onApply = vi.fn();
        const onClear = vi.fn();

        render(
            <DataTableFilters
                schema={[]}
                onApply={onApply}
                onClear={onClear}
                onFilterSelect={vi.fn()}
                savedFilterList={[]}
                isFiltered
                pageSize={50}
                currentFiltersValues={{}}
            />,
        );

        fireEvent.click(screen.getByTestId("dt_filter"));
        fireEvent.change(document.getElementById("pageSize"), { target: { value: "75" } });
        fireEvent.click(screen.getByTestId("btn_dialog_content_close"));

        fireEvent.click(screen.getByTestId("dt_filter_clear"));
        expect(onClear).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByTestId("dt_filter"));
        expect(document.getElementById("pageSize")).toHaveValue("50");

        fireEvent.submit(screen.getByTestId("dt_filter_apply").closest("form"));
        await waitFor(() => expect(onApply).toHaveBeenCalledWith(expect.anything(), 50));
    });
});
