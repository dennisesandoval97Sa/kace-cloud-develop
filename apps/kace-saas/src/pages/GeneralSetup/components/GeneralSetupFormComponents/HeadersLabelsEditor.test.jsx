import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeadersLabelsEditor } from "./HeadersLabelsEditor";
import { HEADERS_CASES_TABLE } from "../../../Cases/data/Constants";

const { mockTranslateRef } = vi.hoisted(() => ({ mockTranslateRef: { current: (key) => key } }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => mockTranslateRef.current(key) }),
}));

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({
        schemaFields: {
            cases: [
                { column_name: "reference", label: "Reference", data_type: "string" },
                { column_name: "estado_actual", label: "Current State", data_type: "string" },
            ],
        },
    }),
}));

vi.mock("@kace_v2/shared/ui/molecules/SelectField", () => ({
    default: ({ value, onValueChange, options, "data-testid": testId }) => (
        <select data-testid={testId} value={value} onChange={(e) => onValueChange(e.target.value)}>
            {(options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    ),
}));

vi.mock("@kace_v2/shared/ui/molecules/FieldWrapper", () => ({
    default: ({ label, children }) => (
        <div>
            <label>{label}</label>
            {children}
        </div>
    ),
}));

vi.mock("@kace/ui-shared", () => ({
    Input: ({ value, onChange, "data-testid": testId }) => (
        <input data-testid={testId} value={value || ""} onChange={(e) => onChange(e)} />
    ),
}));

vi.mock("lucide-react", () => ({
    Plus: () => null,
    Trash2: () => null,
    Angry: () => null,
    Frown: () => null,
    Meh: () => null,
    Laugh: () => null,
}));

describe("HeadersLabelsEditor", () => {
    let setFieldValue;

    beforeEach(() => {
        setFieldValue = vi.fn();
        mockTranslateRef.current = (key) => key;
    });

    const renderEditor = (value = []) => {
        return render(<HeadersLabelsEditor value={value} setFieldValue={setFieldValue} />);
    };

    it("shows empty state when value is empty array", () => {
        renderEditor([]);
        expect(screen.getByTestId("headers_labels_section")).toBeTruthy();
        expect(screen.getByTestId("headers_labels_empty")).toBeTruthy();
        expect(screen.queryByTestId("headers_labels_row_0")).toBeNull();
        expect(screen.getByTestId("headers_labels_add")).toBeTruthy();
    });

    it("renders one row per entry in value", () => {
        renderEditor([{ key: "reference", label: "Consecutivo" }]);

        expect(screen.getByTestId("headers_labels_section")).toBeTruthy();
        expect(screen.getByTestId("headers_labels_row_0")).toBeTruthy();
        expect(screen.getByTestId("headers_labels_input_row_0").value).toBe("Consecutivo");
        expect(screen.getByTestId("headers_labels_remove_row_0")).toBeTruthy();
        expect(screen.getByTestId("headers_labels_add")).toBeTruthy();
    });

    it("adds a new entry when the add button is clicked", async () => {
        renderEditor([]);

        await userEvent.click(screen.getByTestId("headers_labels_add"));

        expect(setFieldValue).toHaveBeenCalledTimes(1);
        const [fieldName, newValue] = setFieldValue.mock.calls[0];
        expect(fieldName).toBe("headers_labels");
        expect(Array.isArray(newValue)).toBe(true);
        expect(newValue).toHaveLength(1);
        expect(newValue[0]).toMatchObject({ key: "", label: "" });
    });

    it("removes a row when the remove button is clicked", async () => {
        renderEditor([{ key: "reference", label: "Consecutivo" }]);
        await userEvent.click(screen.getByTestId("headers_labels_remove_row_0"));

        expect(setFieldValue).toHaveBeenCalledTimes(1);
        const [fieldName, newValue] = setFieldValue.mock.calls[0];
        expect(fieldName).toBe("headers_labels");
        expect(newValue).toEqual([]);
    });

    it("removes the correct row when there are multiple entries", async () => {
        renderEditor([
            { key: "reference", label: "Consecutivo" },
            { key: "estadoActual", label: "Estado" },
        ]);

        await userEvent.click(screen.getByTestId("headers_labels_remove_row_0"));

        const [, newValue] = setFieldValue.mock.calls[0];
        expect(newValue).toEqual([{ key: "estadoActual", label: "Estado" }]);
    });

    it("updates the label when input value changes", () => {
        renderEditor([{ key: "reference", label: "Old" }]);
        const input = screen.getByTestId("headers_labels_input_row_0");
        fireEvent.change(input, { target: { value: "New" } });

        expect(setFieldValue).toHaveBeenCalledTimes(1);
        const [fieldName, newValue] = setFieldValue.mock.calls[0];
        expect(fieldName).toBe("headers_labels");
        expect(newValue).toEqual([{ key: "reference", label: "New" }]);
    });

    it("updates the column key when select value changes", () => {
        renderEditor([{ key: "reference", label: "Consecutivo" }]);
        const select = screen.getByTestId("headers_labels_select_row_0");
        fireEvent.change(select, { target: { value: "estadoActual" } });

        const [, newValue] = setFieldValue.mock.calls[0];
        expect(newValue).toEqual([{ key: "estadoActual", label: "Consecutivo" }]);
    });

    it("exposes all HEADERS_CASES_TABLE keys (with key transforms) plus fecha_vencimiento and subcasos in the column options", () => {
        const KEY_TRANSFORMS = { estado_actual: "estadoActual", nombre_cliente: "nombreCliente" };
        const toColumnKey = (key) => KEY_TRANSFORMS[key] || key;

        renderEditor([{ key: "reference", label: "Consecutivo" }]);

        const select = screen.getByTestId("headers_labels_select_row_0");
        const optionValues = Array.from(select.options).map((o) => o.value);

        for (const entry of HEADERS_CASES_TABLE) {
            expect(optionValues).toContain(toColumnKey(entry.key));
        }
        expect(optionValues).toContain("fecha_vencimiento");
        expect(optionValues).toContain("subcasos");
    });

    it("prefers gridMain.columnsCases.* over the shared gridMain.columns.* key for column labels", () => {
        mockTranslateRef.current = (key) =>
            ({
                "gridMain.columnsCases.Reference": "Cases-specific Reference",
                "gridMain.columns.Reference": "Generic Reference",
            })[key] ?? key;

        renderEditor([{ key: "reference", label: "Consecutivo" }]);

        const select = screen.getByTestId("headers_labels_select_row_0");
        const referenceOption = Array.from(select.options).find((o) => o.value === "reference");
        expect(referenceOption.textContent).toBe("Cases-specific Reference");
    });

    it("falls back to the shared gridMain.columns.* key when columnsCases has no translation", () => {
        mockTranslateRef.current = (key) => (key === "gridMain.columns.Reference" ? "Generic Reference" : key);

        renderEditor([{ key: "reference", label: "Consecutivo" }]);

        const select = screen.getByTestId("headers_labels_select_row_0");
        const referenceOption = Array.from(select.options).find((o) => o.value === "reference");
        expect(referenceOption.textContent).toBe("Generic Reference");
    });

    it("applies the same columnsCases-first rule to the subcasos option (matches CasesTableComponent's resolveHeader)", () => {
        mockTranslateRef.current = (key) =>
            ({ "gridMain.columnsCases.subcases": "Cases-specific Subcases" })[key] ?? key;

        renderEditor([{ key: "reference", label: "Consecutivo" }]);

        const select = screen.getByTestId("headers_labels_select_row_0");
        const subcasosOption = Array.from(select.options).find((o) => o.value === "subcasos");
        expect(subcasosOption.textContent).toBe("Cases-specific Subcases");
    });

    it("migrates old map-shaped value defensively to an array of entries", () => {
        const setFieldValueSpy = vi.fn();
        render(<HeadersLabelsEditor value={{ reference: "Consecutivo" }} setFieldValue={setFieldValueSpy} />);
        expect(screen.getByTestId("headers_labels_row_0")).toBeTruthy();
        expect(screen.getByTestId("headers_labels_input_row_0").value).toBe("Consecutivo");
    });
});
