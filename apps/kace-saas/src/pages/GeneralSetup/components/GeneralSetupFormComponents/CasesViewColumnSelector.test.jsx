import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CasesViewColumnSelector from "./CasesViewColumnSelector";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@/componentsV2/core/MultiSelect", () => ({
    default: ({ options, selectedData, onSelectOption, onClearSelection }) => (
        <div data-testid="multiselect">
            {options.map((opt) => (
                <button key={opt.id} data-testid={`opt-${opt.id}`} onClick={() => onSelectOption(opt.id)}>
                    {opt.label}
                    {selectedData.some((s) => s.id === opt.id) ? " (selected)" : ""}
                </button>
            ))}
            {onClearSelection && (
                <button data-testid="clear-all" onClick={onClearSelection}>
                    Clear
                </button>
            )}
        </div>
    ),
}));

const SCHEMA_FIELDS = {
    view_case_details: [
        { column_name: "reference", label: "Consecutivo", data_type: "string" },
        { column_name: "estadoactual", label: "Estado Actual", data_type: "string" },
        { column_name: "deleted_at", label: "Deleted At", data_type: "date" },
        { column_name: "responsable_id", label: "Responsable ID", data_type: "string" },
        { column_name: "id", label: "ID", data_type: "string" },
    ],
};

describe("CasesViewColumnSelector", () => {
    it("renders null when viewName is falsy", () => {
        const { container } = render(
            <CasesViewColumnSelector viewName="" schemaFields={SCHEMA_FIELDS} value={[]} onChange={vi.fn()} />,
        );
        expect(container.firstChild).toBeNull();
    });

    it("excludes system fields from rendered options", () => {
        render(
            <CasesViewColumnSelector
                viewName="view_case_details"
                schemaFields={SCHEMA_FIELDS}
                value={[]}
                onChange={vi.fn()}
            />,
        );
        expect(screen.queryByTestId("opt-deleted_at")).toBeNull();
        expect(screen.queryByTestId("opt-responsable_id")).toBeNull();
        expect(screen.queryByTestId("opt-id")).toBeNull();
    });

    it("renders non-system columns as options", () => {
        render(
            <CasesViewColumnSelector
                viewName="view_case_details"
                schemaFields={SCHEMA_FIELDS}
                value={[]}
                onChange={vi.fn()}
            />,
        );
        expect(screen.getByTestId("opt-reference")).toBeTruthy();
        expect(screen.getByTestId("opt-estadoactual")).toBeTruthy();
    });

    it("calls onChange with column added when selecting", async () => {
        const onChange = vi.fn();
        render(
            <CasesViewColumnSelector
                viewName="view_case_details"
                schemaFields={SCHEMA_FIELDS}
                value={[]}
                onChange={onChange}
            />,
        );
        await userEvent.click(screen.getByTestId("opt-reference"));
        expect(onChange).toHaveBeenCalledWith(["reference"]);
    });

    it("calls onChange with column removed when deselecting", async () => {
        const onChange = vi.fn();
        render(
            <CasesViewColumnSelector
                viewName="view_case_details"
                schemaFields={SCHEMA_FIELDS}
                value={["reference", "estadoactual"]}
                onChange={onChange}
            />,
        );
        await userEvent.click(screen.getByTestId("opt-reference"));
        expect(onChange).toHaveBeenCalledWith(["estadoactual"]);
    });

    it("shows column as selected when its id is in value", () => {
        render(
            <CasesViewColumnSelector
                viewName="view_case_details"
                schemaFields={SCHEMA_FIELDS}
                value={["reference"]}
                onChange={vi.fn()}
            />,
        );
        expect(screen.getByTestId("opt-reference").textContent).toContain("(selected)");
        expect(screen.getByTestId("opt-estadoactual").textContent).not.toContain("(selected)");
    });
});
