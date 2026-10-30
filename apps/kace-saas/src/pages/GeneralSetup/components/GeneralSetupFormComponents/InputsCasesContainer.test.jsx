import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InputsCasesContainer from "./InputsCasesContainer";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({
        schemaFields: {
            view_case_details: [{ column_name: "reference", label: "Reference", data_type: "string" }],
        },
    }),
}));

vi.mock("@kace_v2/shared/ui/molecules/SelectField", () => ({
    default: ({ onValueChange }) => (
        <select data-testid="select-view" onChange={(e) => onValueChange(e.target.value)}>
            <option value="">None</option>
            <option value="view_case_details">view_case_details</option>
        </select>
    ),
}));

vi.mock("@kace/ui-shared", () => ({
    InputForm: ({ label, onChange, value, ...inputProps }) => (
        <input {...inputProps} data-testid="refresh-input" aria-label={label} value={value || ""} onChange={onChange} />
    ),
}));

vi.mock("./CheckBoxContainer", () => ({
    CheckBoxContainer: ({ value, setFieldValue, name, text }) => (
        <button data-testid={`checkbox-${name}`} onClick={() => setFieldValue(name, !value)} aria-checked={value}>
            {text}
        </button>
    ),
}));

vi.mock("./CasesViewColumnEditor", () => ({
    default: () => <div data-testid="column-selector" />,
}));

const defaultValues = {
    enable_admin_custom_view: false,
    admin_custom_view_name: "",
    admin_visible_columns: [],
    cases_admin_refresh_min: "1",
};

describe("InputsCasesContainer", () => {
    it("does not render CasesViewColumnSelector when enable_admin_custom_view is false", () => {
        render(
            <InputsCasesContainer
                values={{ ...defaultValues, enable_admin_custom_view: false }}
                setFieldValue={vi.fn()}
            />,
        );
        expect(screen.queryByTestId("column-selector")).toBeNull();
    });

    it("does not render CasesViewColumnSelector when view is enabled but no view name selected", () => {
        render(
            <InputsCasesContainer
                values={{ ...defaultValues, enable_admin_custom_view: true, admin_custom_view_name: "" }}
                setFieldValue={vi.fn()}
            />,
        );
        expect(screen.queryByTestId("column-selector")).toBeNull();
    });

    it("renders CasesViewColumnSelector when view is enabled and a view name is selected", () => {
        render(
            <InputsCasesContainer
                values={{
                    ...defaultValues,
                    enable_admin_custom_view: true,
                    admin_custom_view_name: "view_case_details",
                }}
                setFieldValue={vi.fn()}
            />,
        );
        expect(screen.getByTestId("column-selector")).toBeTruthy();
    });

    it("resets admin_visible_columns when custom view is disabled", async () => {
        const setFieldValue = vi.fn();
        render(
            <InputsCasesContainer
                values={{
                    ...defaultValues,
                    enable_admin_custom_view: true,
                    admin_custom_view_name: "view_case_details",
                }}
                setFieldValue={setFieldValue}
            />,
        );
        await userEvent.click(screen.getByTestId("checkbox-enable_admin_custom_view"));
        expect(setFieldValue).toHaveBeenCalledWith("admin_visible_columns", []);
    });

    describe("refresh minutes input", () => {
        const renderRefreshInput = () => {
            render(<InputsCasesContainer values={defaultValues} setFieldValue={vi.fn()} />);
            return screen.getByTestId("refresh-input");
        };
        const paste = (input, text) => fireEvent.paste(input, { clipboardData: { getData: () => text } });

        it.each(["-", "e", "E", "+"])("blocks typing %s", (key) => {
            expect(fireEvent.keyDown(renderRefreshInput(), { key })).toBe(false);
        });

        it("keeps accepting a decimal point for fractional minutes", () => {
            expect(fireEvent.keyDown(renderRefreshInput(), { key: "." })).toBe(true);
        });

        it.each(["-5", "1e3", "+2"])("blocks pasting %s", (text) => {
            expect(paste(renderRefreshInput(), text)).toBe(false);
        });

        it("accepts pasting fractional minutes", () => {
            expect(paste(renderRefreshInput(), "0.5")).toBe(true);
        });
    });
});
