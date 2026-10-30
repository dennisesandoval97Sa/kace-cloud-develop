import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ColumnConfigModal from "./ColumnConfigModal";

let dialogOnOpenChange = null;

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, fallback) => {
            const map = {
                "button.add": "Agregar",
                "button.save": "Guardar",
                "button.close": "Cerrar",
            };
            return map[key] || fallback || key;
        },
    }),
}));

vi.mock("@radix-ui/react-dialog", () => ({
    Dialog: ({ open, children, onOpenChange }) => {
        dialogOnOpenChange = onOpenChange;
        return open ? <div data-testid="dialog">{children}</div> : null;
    },
    Portal: ({ children }) => <div>{children}</div>,
}));

vi.mock("@kace_v2/shared/ui/atoms/DialogOverlay", () => ({
    default: () => <div data-testid="dialog-overlay" />,
}));

vi.mock("@kace_v2/shared/ui/atoms/DialogContent", () => ({
    default: ({ children }) => <div>{children}</div>,
}));

vi.mock("@kace_v2/shared/ui/atoms/DialogClose", () => ({
    default: ({ children, asChild }) => {
        const triggerClose = () => dialogOnOpenChange?.(false);
        if (asChild && React.isValidElement(children)) {
            return React.cloneElement(children, {
                onClick: (event) => {
                    children.props.onClick?.(event);
                    triggerClose();
                },
            });
        }
        return (
            <button type="button" onClick={triggerClose}>
                {children}
            </button>
        );
    },
}));

vi.mock("@kace_v2/shared/ui/atoms/DialogTitle", () => ({
    default: ({ children }) => <h2>{children}</h2>,
}));

vi.mock("@kace_v2/shared/ui/atoms/DialogDescription", () => ({
    default: ({ children }) => <p>{children}</p>,
}));

vi.mock("@kace_v2/shared/ui/atoms/Button", () => ({
    default: ({ children, onClick, disabled, type, "aria-label": ariaLabel }) => (
        <button onClick={onClick} disabled={disabled} type={type} aria-label={ariaLabel}>
            {children}
        </button>
    ),
}));

vi.mock("@kace_v2/shared/ui/molecules/SelectField", () => ({
    default: ({ label, value, onValueChange, options, placeholder, name }) => (
        <div>
            <label>{label}</label>
            <select
                aria-label={label}
                name={name}
                value={value || ""}
                onChange={(e) => onValueChange?.(e.target.value)}
            >
                <option value="">{placeholder}</option>
                {options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    ),
}));

vi.mock("@kace_v2/shared/ui/molecules/SwitchField", () => ({
    default: ({ label, checked, onCheckedChange, name }) => (
        <label>
            {label}
            <input
                type="checkbox"
                role="switch"
                name={name}
                checked={checked}
                onChange={(e) => onCheckedChange?.(e.target.checked)}
            />
        </label>
    ),
}));

const toastError = vi.fn();

vi.mock("sonner", () => ({
    toast: {
        error: (...args) => toastError(...args),
    },
}));

vi.mock("@kace_v2/shared/ui/molecules/InputField", () => ({
    default: ({ label, value, defaultValue, onChange, placeholder, name, ...props }) => (
        <div>
            <label>{label}</label>
            <input
                aria-label={label}
                name={name}
                value={value ?? defaultValue ?? ""}
                onChange={onChange}
                placeholder={placeholder}
                {...props}
            />
        </div>
    ),
}));

const SCHEMA_FIELDS = {
    view_cases: [
        { column_name: "reference", label: "Consecutivo", data_type: "string" },
        { column_name: "estadoactual", label: "Estado Actual", data_type: "string" },
        { column_name: "nivel1", label: "Nivel 1", data_type: "string" },
        { column_name: "nivel2", label: "Nivel 2", data_type: "string" },
        { column_name: "nivel5", label: "Nivel 5", data_type: "string" },
        { column_name: "custom_field", label: "Campo Personalizado", data_type: "string" },
    ],
};

const DEFAULT_PROPS = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    initialValues: null,
    schemaFields: SCHEMA_FIELDS,
    viewName: "view_cases",
    existingColumnNames: [],
};

describe("ColumnConfigModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders with empty form in add mode (no initialValues)", () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        expect(columnSelect).toBeTruthy();
        expect(columnSelect.value).toBe("");

        const headerInput = screen.getByPlaceholderText(/cabecera/i);
        expect(headerInput).toBeTruthy();
        expect(headerInput.value).toBe("");

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        expect(cellTypeSelect).toBeTruthy();
        expect(cellTypeSelect.value).toBe("default");
    });

    it("renders pre-filled with initialValues in edit mode", () => {
        const initialValues = {
            column_name: "reference",
            header_label: "Mi Consecutivo",
            cell_type: "estado",
            separator: undefined,
        };

        render(<ColumnConfigModal {...DEFAULT_PROPS} initialValues={initialValues} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        expect(columnSelect.value).toBe("reference");

        const headerInput = screen.getByDisplayValue("Mi Consecutivo");
        expect(headerInput).toBeTruthy();

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        expect(cellTypeSelect.value).toBe("estado");
    });

    it("column selector excludes existingColumnNames", () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} existingColumnNames={["reference", "estadoactual"]} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        const options = Array.from(columnSelect.options).map((o) => o.value);

        expect(options).not.toContain("reference");
        expect(options).not.toContain("estadoactual");
        expect(options).toContain("nivel1");
        expect(options).toContain("custom_field");
    });

    it("column selector includes the column being edited in edit mode", () => {
        const initialValues = {
            column_name: "reference",
            header_label: "Consecutivo",
            cell_type: "default",
        };

        render(
            <ColumnConfigModal
                {...DEFAULT_PROPS}
                initialValues={initialValues}
                existingColumnNames={["reference", "estadoactual"]}
            />,
        );

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        const options = Array.from(columnSelect.options).map((o) => o.value);

        expect(options).toContain("reference");
        expect(options).not.toContain("estadoactual");
    });

    it("selecting a column auto-fills the header_label with column_name", async () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "estadoactual" } });

        const headerInput = screen.getByPlaceholderText(/cabecera/i);
        expect(headerInput.value).toBe("estadoactual");
    });

    it("excludes schema columns without a valid column_name", () => {
        const schemaWithInvalidColumns = {
            view_cases: [
                { column_name: "reference", label: "Consecutivo", data_type: "string" },
                { label: "Sin nombre", data_type: "string" },
                { column_name: "", label: "Vacio", data_type: "string" },
                { column_name: "valid_field", label: undefined, data_type: "string" },
            ],
        };

        render(<ColumnConfigModal {...DEFAULT_PROPS} schemaFields={schemaWithInvalidColumns} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        const options = Array.from(columnSelect.querySelectorAll("option"))
            .map((opt) => opt.value)
            .filter(Boolean);

        expect(options).toEqual(["reference", "valid_field"]);
    });

    it("shows column_name as the option label", () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        const referenceOption = Array.from(columnSelect.querySelectorAll("option")).find(
            (opt) => opt.value === "reference",
        );

        expect(referenceOption?.textContent).toBe("reference");
    });

    it("auto-fills header_label with column_name when label is absent", async () => {
        const schemaWithoutLabel = {
            view_test: [{ column_name: "raw_col", data_type: "string" }],
        };

        render(<ColumnConfigModal {...DEFAULT_PROPS} schemaFields={schemaWithoutLabel} viewName="view_test" />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "raw_col" } });

        const headerInput = screen.getByPlaceholderText(/cabecera/i);
        expect(headerInput.value).toBe("raw_col");
    });

    it("separador field is hidden when cell_type is not clasificacion", () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} />);

        expect(screen.queryByPlaceholderText(/separador/i)).toBeNull();
        expect(screen.queryByText(/Separador de niveles en la vista/i)).toBeNull();
    });

    it("separador field is shown when cell_type is clasificacion on non-level fields", () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "custom_field" } });

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        fireEvent.change(cellTypeSelect, { target: { value: "clasificacion" } });

        expect(screen.getByText(/Separador de niveles en la vista/i)).toBeTruthy();
    });

    it("shows expand levels switch for nivel clasificacion columns", () => {
        const initialValues = {
            column_name: "nivel5",
            header_label: "Nivel 5",
            cell_type: "clasificacion",
            expand_levels: true,
        };

        render(<ColumnConfigModal {...DEFAULT_PROPS} initialValues={initialValues} />);

        expect(screen.getByText("Agrupar y expandir clasificaciones")).toBeTruthy();
        expect(screen.getByRole("switch")).toBeChecked();
    });

    it("hides separator for nivel clasificacion columns", () => {
        const initialValues = {
            column_name: "nivel1",
            header_label: "Nivel 1",
            cell_type: "clasificacion",
        };

        render(<ColumnConfigModal {...DEFAULT_PROPS} initialValues={initialValues} />);

        expect(screen.queryByText(/Separador de niveles en la vista/i)).toBeNull();
    });

    it("shows helper text for the separator input when clasificacion is selected on non-level fields", () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "custom_field" } });

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        fireEvent.change(cellTypeSelect, { target: { value: "clasificacion" } });

        expect(screen.getByText(/separar los niveles de la clasificación/i)).toBeInTheDocument();
        expect(screen.getByText(/Caracter que se usa/)).toBeInTheDocument();
        expect(screen.queryByText(/Carácter/)).toBeNull();
        expect(screen.getByLabelText(/Separador de niveles en la vista/i)).toHaveAttribute(
            "aria-describedby",
            "column-separator-help",
        );
        expect(document.getElementById("column-separator-help")).toHaveTextContent(
            /separar los niveles de la clasificación/i,
        );
    });

    it("normal save calls onSave with correct VisibleColumn object", async () => {
        const onSave = vi.fn();
        render(<ColumnConfigModal {...DEFAULT_PROPS} onSave={onSave} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "reference" } });

        const headerInput = screen.getByPlaceholderText(/cabecera/i);
        fireEvent.change(headerInput, { target: { value: "Ref" } });

        fireEvent.click(screen.getByText("Agregar"));

        expect(onSave).toHaveBeenCalledOnce();
        expect(onSave).toHaveBeenCalledWith({
            column_name: "reference",
            header_label: "Ref",
            cell_type: "default",
        });
    });

    it("save includes separator when cell_type is clasificacion on non-level fields", async () => {
        const onSave = vi.fn();
        render(<ColumnConfigModal {...DEFAULT_PROPS} onSave={onSave} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "custom_field" } });

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        fireEvent.change(cellTypeSelect, { target: { value: "clasificacion" } });

        const separatorInput = screen.getByLabelText(/Separador de niveles en la vista/i);
        fireEvent.change(separatorInput, { target: { value: " > " } });

        fireEvent.click(screen.getByRole("switch"));
        fireEvent.click(screen.getByText("Agregar"));

        expect(onSave).toHaveBeenCalledWith({
            column_name: "custom_field",
            header_label: "custom_field",
            cell_type: "clasificacion",
            separator: ">",
            expand_levels: false,
        });
    });

    it("shows expand switch after separator is defined on clasificacion fields", () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "custom_field" } });

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        fireEvent.change(cellTypeSelect, { target: { value: "clasificacion" } });

        expect(screen.queryByRole("switch")).toBeNull();

        const separatorInput = screen.getByLabelText(/Separador de niveles en la vista/i);
        fireEvent.change(separatorInput, { target: { value: "->" } });

        expect(screen.getByRole("switch")).toBeChecked();
    });

    it("save includes expand_levels for separator clasificacion columns", async () => {
        const onSave = vi.fn();
        render(<ColumnConfigModal {...DEFAULT_PROPS} onSave={onSave} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "custom_field" } });

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        fireEvent.change(cellTypeSelect, { target: { value: "clasificacion" } });

        const separatorInput = screen.getByLabelText(/Separador de niveles en la vista/i);
        fireEvent.change(separatorInput, { target: { value: "->" } });

        fireEvent.click(screen.getByText("Agregar"));

        expect(onSave).toHaveBeenCalledWith({
            column_name: "custom_field",
            header_label: "custom_field",
            cell_type: "clasificacion",
            separator: "->",
            expand_levels: true,
        });
    });

    it("save includes expand_levels for nivel clasificacion columns", async () => {
        const onSave = vi.fn();
        render(<ColumnConfigModal {...DEFAULT_PROPS} onSave={onSave} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "nivel1" } });

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        fireEvent.change(cellTypeSelect, { target: { value: "clasificacion" } });

        fireEvent.click(screen.getByText("Agregar"));

        expect(onSave).toHaveBeenCalledWith({
            column_name: "nivel1",
            header_label: "nivel1",
            cell_type: "clasificacion",
            expand_levels: true,
        });
    });

    it("hides nivel fields when an expandable classification column already exists", () => {
        render(
            <ColumnConfigModal
                {...DEFAULT_PROPS}
                expandableClassificationColumn={{
                    column_name: "nivel5",
                    header_label: "Nivel 5",
                    cell_type: "clasificacion",
                    expand_levels: true,
                }}
            />,
        );

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        const options = Array.from(columnSelect.querySelectorAll("option")).map((opt) => opt.value);

        expect(options).toContain("reference");
        expect(options).not.toContain("nivel1");
        expect(options).not.toContain("nivel5");
    });

    it("blocks saving another expandable separator clasificacion column when one already exists", () => {
        const onSave = vi.fn();

        render(
            <ColumnConfigModal
                {...DEFAULT_PROPS}
                onSave={onSave}
                expandableClassificationColumn={{
                    column_name: "custom_field",
                    header_label: "custom_field",
                    cell_type: "clasificacion",
                    separator: "->",
                    expand_levels: true,
                }}
            />,
        );

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "reference" } });

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        fireEvent.change(cellTypeSelect, { target: { value: "clasificacion" } });

        const separatorInput = screen.getByLabelText(/Separador de niveles en la vista/i);
        fireEvent.change(separatorInput, { target: { value: "->" } });

        fireEvent.click(screen.getByText("Agregar"));

        expect(toastError).toHaveBeenCalledOnce();
        expect(onSave).not.toHaveBeenCalled();
    });

    it("blocks saving another nivel clasificacion column when expandable already exists", () => {
        const onSave = vi.fn();

        render(
            <ColumnConfigModal
                {...DEFAULT_PROPS}
                onSave={onSave}
                expandableClassificationColumn={{
                    column_name: "nivel5",
                    header_label: "Nivel 5",
                    cell_type: "clasificacion",
                    expand_levels: true,
                }}
                initialValues={{
                    column_name: "nivel2",
                    header_label: "Nivel 2",
                    cell_type: "clasificacion",
                }}
            />,
        );

        fireEvent.click(screen.getByText("Guardar"));

        expect(toastError).toHaveBeenCalledOnce();
        expect(onSave).not.toHaveBeenCalled();
    });

    it("save persists expand_levels false for single-column nivel clasificacion", async () => {
        const onSave = vi.fn();
        render(<ColumnConfigModal {...DEFAULT_PROPS} onSave={onSave} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "nivel2" } });

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        fireEvent.change(cellTypeSelect, { target: { value: "clasificacion" } });

        fireEvent.click(screen.getByRole("switch"));
        fireEvent.click(screen.getByText("Agregar"));

        expect(onSave).toHaveBeenCalledWith({
            column_name: "nivel2",
            header_label: "nivel2",
            cell_type: "clasificacion",
            expand_levels: false,
        });
    });

    it("save button is disabled when no column is selected", () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} />);

        const saveButton = screen.getByText("Agregar");
        expect(saveButton).toBeDisabled();
    });

    it("save button is enabled when a column is selected", () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "reference" } });

        const saveButton = screen.getByText("Agregar");
        expect(saveButton).not.toBeDisabled();
    });

    it("add button does not submit as a form submit control", () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} />);

        const addButton = screen.getByText("Agregar");
        expect(addButton.getAttribute("type")).toBe("button");
    });

    it("close button calls onClose", () => {
        const onClose = vi.fn();
        render(<ColumnConfigModal {...DEFAULT_PROPS} onClose={onClose} />);

        fireEvent.click(screen.getByLabelText("Cerrar"));

        expect(onClose).toHaveBeenCalledOnce();
    });

    it("does not render content when isOpen is false", () => {
        render(<ColumnConfigModal {...DEFAULT_PROPS} isOpen={false} />);

        expect(screen.queryByRole("combobox", { name: /campo/i })).toBeNull();
    });

    it("header_label defaults to column_name when user clears the input", () => {
        const onSave = vi.fn();
        render(<ColumnConfigModal {...DEFAULT_PROPS} onSave={onSave} />);

        const columnSelect = screen.getByRole("combobox", { name: /campo/i });
        fireEvent.change(columnSelect, { target: { value: "reference" } });

        const headerInput = screen.getByPlaceholderText(/cabecera/i);
        fireEvent.change(headerInput, { target: { value: "" } });

        fireEvent.click(screen.getByText("Agregar"));

        expect(onSave).toHaveBeenCalledWith({
            column_name: "reference",
            header_label: "reference",
            cell_type: "default",
        });
    });

    it("hides estado cell type when a status column already exists", () => {
        render(
            <ColumnConfigModal
                {...DEFAULT_PROPS}
                statusColumn={{
                    column_name: "estadoactual",
                    header_label: "Estado",
                    cell_type: "estado",
                }}
            />,
        );

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        const options = Array.from(cellTypeSelect.querySelectorAll("option")).map((opt) => opt.value);

        expect(options).toContain("default");
        expect(options).toContain("clasificacion");
        expect(options).not.toContain("estado");
    });

    it("blocks saving another status column when one already exists", () => {
        const onSave = vi.fn();

        render(
            <ColumnConfigModal
                {...DEFAULT_PROPS}
                onSave={onSave}
                statusColumn={{
                    column_name: "estadoactual",
                    header_label: "Estado",
                    cell_type: "estado",
                }}
                initialValues={{
                    column_name: "reference",
                    header_label: "reference",
                    cell_type: "estado",
                }}
            />,
        );

        fireEvent.click(screen.getByText("Guardar"));

        expect(toastError).toHaveBeenCalledOnce();
        expect(onSave).not.toHaveBeenCalled();
    });

    it("allows editing the existing status column", () => {
        const onSave = vi.fn();

        render(
            <ColumnConfigModal
                {...DEFAULT_PROPS}
                onSave={onSave}
                statusColumn={{
                    column_name: "estadoactual",
                    header_label: "Estado",
                    cell_type: "estado",
                }}
                initialValues={{
                    column_name: "estadoactual",
                    header_label: "Estado actual",
                    cell_type: "estado",
                }}
            />,
        );

        fireEvent.click(screen.getByText("Guardar"));

        expect(toastError).not.toHaveBeenCalled();
        expect(onSave).toHaveBeenCalledWith({
            column_name: "estadoactual",
            header_label: "Estado actual",
            cell_type: "estado",
        });
    });

    it("hides clasificacion cell type when a classification column already exists", () => {
        render(
            <ColumnConfigModal
                {...DEFAULT_PROPS}
                classificationColumn={{
                    column_name: "nivel1",
                    header_label: "Nivel 1",
                    cell_type: "clasificacion",
                }}
            />,
        );

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        const options = Array.from(cellTypeSelect.querySelectorAll("option")).map((opt) => opt.value);

        expect(options).toContain("default");
        expect(options).toContain("estado");
        expect(options).not.toContain("clasificacion");
    });

    it("hides both estado and clasificacion when status and classification columns already exist", () => {
        render(
            <ColumnConfigModal
                {...DEFAULT_PROPS}
                statusColumn={{
                    column_name: "estadoactual",
                    header_label: "Estado",
                    cell_type: "estado",
                }}
                classificationColumn={{
                    column_name: "nivel1",
                    header_label: "Nivel 1",
                    cell_type: "clasificacion",
                }}
            />,
        );

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        const options = Array.from(cellTypeSelect.querySelectorAll("option")).map((opt) => opt.value);

        expect(options).toContain("default");
        expect(options).not.toContain("estado");
        expect(options).not.toContain("clasificacion");
    });

    it("allows editing the existing classification column", () => {
        const onSave = vi.fn();

        render(
            <ColumnConfigModal
                {...DEFAULT_PROPS}
                onSave={onSave}
                classificationColumn={{
                    column_name: "nivel1",
                    header_label: "Nivel 1",
                    cell_type: "clasificacion",
                    expand_levels: true,
                }}
                initialValues={{
                    column_name: "nivel1",
                    header_label: "Nivel 1 (custom)",
                    cell_type: "clasificacion",
                }}
            />,
        );

        fireEvent.click(screen.getByText("Guardar"));

        expect(toastError).not.toHaveBeenCalled();
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                column_name: "nivel1",
                cell_type: "clasificacion",
            }),
        );
    });

    it("allows editing a persisted classification column that is not the first one", () => {
        const onSave = vi.fn();

        render(
            <ColumnConfigModal
                {...DEFAULT_PROPS}
                onSave={onSave}
                classificationColumn={{
                    column_name: "nivel1",
                    header_label: "Nivel 1",
                    cell_type: "clasificacion",
                    expand_levels: true,
                }}
                initialValues={{
                    column_name: "clasificacion_path",
                    header_label: "Path",
                    cell_type: "clasificacion",
                    separator: "->",
                }}
            />,
        );

        const cellTypeSelect = screen.getByRole("combobox", { name: /tipo/i });
        const options = Array.from(cellTypeSelect.querySelectorAll("option")).map((opt) => opt.value);
        expect(options).toContain("clasificacion");

        fireEvent.click(screen.getByText("Guardar"));

        expect(toastError).not.toHaveBeenCalled();
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                column_name: "clasificacion_path",
                cell_type: "clasificacion",
            }),
        );
    });
});
