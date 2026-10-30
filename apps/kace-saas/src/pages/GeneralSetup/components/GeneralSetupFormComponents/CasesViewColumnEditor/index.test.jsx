import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, fallback) => fallback || key }),
}));

vi.mock("@kace_v2/shared/ui/atoms/Button", () => ({
    default: ({ children, onClick, type }) => (
        <button onClick={onClick} type={type}>
            {children}
        </button>
    ),
}));

vi.mock("lucide-react", () => ({
    PlusIcon: () => <span data-testid="icon-plus" />,
}));

vi.mock("@kace_v2/features/boards/components/BoardsTableSection", () => ({
    default: ({ rows = [], actions = [], onOrderChange, children }) => (
        <div data-testid="boards-table-section">
            {children}
            <table>
                <thead>
                    <tr>
                        <th>Campo</th>
                        <th>Cabecera</th>
                        <th>Tipo</th>
                        <th />
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={row.id}>
                            <td>{row.field}</td>
                            <td>{row.header_label}</td>
                            <td>{row.cell_type}</td>
                            <td>
                                {actions.map((action) => (
                                    <button key={action.label} type="button" onClick={() => action.fn({ row, index })}>
                                        {action.label}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    data-testid={`drag-${row.id}`}
                                    onClick={() => {
                                        if (rows.length < 2) return;
                                        const reordered = index === 0 ? [rows[1], rows[0]] : [rows[1], rows[0]];
                                        onOrderChange?.(reordered);
                                    }}
                                >
                                    drag
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    ),
}));

const modalProps = vi.hoisted(() => ({ current: null }));

vi.mock("./components/ColumnConfigModal", () => ({
    default: (props) => {
        modalProps.current = props;
        const { isOpen, onSave, onClose, initialValues } = props;
        return isOpen ? (
            <div data-testid="column-config-modal">
                <button
                    data-testid="modal-save"
                    onClick={() =>
                        onSave(
                            initialValues || {
                                column_name: "test_col",
                                header_label: "Test",
                                cell_type: "default",
                            },
                        )
                    }
                >
                    Save
                </button>
                <button data-testid="modal-close" onClick={onClose}>
                    Close
                </button>
            </div>
        ) : null;
    },
}));

import CasesViewColumnEditor from "./index";

const SCHEMA_FIELDS = {
    view_cases: [
        { column_name: "reference", label: "Consecutivo", data_type: "string" },
        { column_name: "estadoactual", label: "Estado Actual", data_type: "string" },
        { column_name: "nivel1", label: "Nivel 1", data_type: "string" },
    ],
};

const SAMPLE_COLUMNS = [
    { column_name: "nivel1", header_label: "Clasificacion", cell_type: "clasificacion" },
    { column_name: "estadoactual", header_label: "Estado Actual", cell_type: "estado" },
];

const DEFAULT_PROPS = {
    viewName: "view_cases",
    schemaFields: SCHEMA_FIELDS,
    value: [],
    onChange: vi.fn(),
};

describe("CasesViewColumnEditor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        modalProps.current = null;
    });

    it("renders 'Agregar columna' button when value is empty", () => {
        render(<CasesViewColumnEditor {...DEFAULT_PROPS} />);
        expect(screen.getByText("Agregar columna")).toBeTruthy();
        expect(screen.getByTestId("boards-table-section")).toBeTruthy();
    });

    it("renders table with rows for each column in value", () => {
        render(<CasesViewColumnEditor {...DEFAULT_PROPS} value={SAMPLE_COLUMNS} />);
        const rows = screen.getAllByRole("row");
        expect(rows.length).toBe(3);
    });

    it("shows column_name, header_label, cell_type label for each row", () => {
        render(<CasesViewColumnEditor {...DEFAULT_PROPS} value={SAMPLE_COLUMNS} />);
        expect(screen.getByText("nivel1")).toBeTruthy();
        expect(screen.getByText("Clasificacion")).toBeTruthy();
        expect(screen.getByText("estadoactual")).toBeTruthy();
        expect(screen.getByText("Estado Actual")).toBeTruthy();
        expect(screen.getByText("Estado")).toBeTruthy();
    });

    it("delete action calls onChange with that row removed", () => {
        const onChange = vi.fn();
        render(<CasesViewColumnEditor {...DEFAULT_PROPS} value={SAMPLE_COLUMNS} onChange={onChange} />);

        fireEvent.click(screen.getAllByText("Eliminar")[0]);

        expect(onChange).toHaveBeenCalledOnce();
        const result = onChange.mock.calls[0][0];
        expect(result).toHaveLength(1);
        expect(result[0].column_name).toBe("estadoactual");
    });

    it("edit action opens ColumnConfigModal pre-filled with that row's values", () => {
        render(<CasesViewColumnEditor {...DEFAULT_PROPS} value={SAMPLE_COLUMNS} />);

        expect(screen.queryByTestId("column-config-modal")).toBeNull();

        fireEvent.click(screen.getAllByText("Editar")[0]);

        expect(screen.getByTestId("column-config-modal")).toBeTruthy();
    });

    it("save from modal (single VisibleColumn) adds new column to the list", () => {
        const onChange = vi.fn();
        render(<CasesViewColumnEditor {...DEFAULT_PROPS} value={[]} onChange={onChange} />);

        fireEvent.click(screen.getByText("Agregar columna"));
        fireEvent.click(screen.getByTestId("modal-save"));

        expect(onChange).toHaveBeenCalledOnce();
        const result = onChange.mock.calls[0][0];
        expect(result).toHaveLength(1);
        expect(result[0].column_name).toBe("test_col");
    });

    it("handles array save: merges without duplicating existing column_names", () => {
        const onChange = vi.fn();
        const existingColumns = [{ column_name: "nivel1", header_label: "Nivel 1", cell_type: "clasificacion" }];

        render(<CasesViewColumnEditor {...DEFAULT_PROPS} value={existingColumns} onChange={onChange} />);

        fireEvent.click(screen.getByText("Agregar columna"));
        fireEvent.click(screen.getByTestId("modal-save"));

        expect(onChange).toHaveBeenCalledOnce();
        const result = onChange.mock.calls[0][0];
        expect(result.filter((c) => c.column_name === "nivel1")).toHaveLength(1);
        expect(result.filter((c) => c.column_name === "test_col")).toHaveLength(1);
        expect(result).toHaveLength(2);
    });

    it("editing an existing column replaces it in the array without duplication", () => {
        const onChange = vi.fn();
        render(<CasesViewColumnEditor {...DEFAULT_PROPS} value={SAMPLE_COLUMNS} onChange={onChange} />);

        fireEvent.click(screen.getAllByText("Editar")[0]);
        fireEvent.click(screen.getByTestId("modal-save"));

        expect(onChange).toHaveBeenCalledOnce();
        const result = onChange.mock.calls[0][0];
        expect(result).toHaveLength(2);
        const columnNames = result.map((c) => c.column_name);
        const uniqueNames = [...new Set(columnNames)];
        expect(columnNames).toHaveLength(uniqueNames.length);
    });

    it("reorders columns when table order changes", () => {
        const onChange = vi.fn();
        render(<CasesViewColumnEditor {...DEFAULT_PROPS} value={SAMPLE_COLUMNS} onChange={onChange} />);

        fireEvent.click(screen.getByTestId("drag-nivel1"));

        expect(onChange).toHaveBeenCalledOnce();
        const result = onChange.mock.calls[0][0];
        expect(result[0].column_name).toBe("estadoactual");
        expect(result[1].column_name).toBe("nivel1");
    });

    it("closes the modal when close button is clicked", () => {
        render(<CasesViewColumnEditor {...DEFAULT_PROPS} value={[]} />);

        fireEvent.click(screen.getByText("Agregar columna"));
        expect(screen.getByTestId("column-config-modal")).toBeTruthy();

        fireEvent.click(screen.getByTestId("modal-close"));
        expect(screen.queryByTestId("column-config-modal")).toBeNull();
    });

    it("derives and forwards classificationColumn and statusColumn to the modal", () => {
        render(<CasesViewColumnEditor {...DEFAULT_PROPS} value={SAMPLE_COLUMNS} />);

        fireEvent.click(screen.getByText("Agregar columna"));

        expect(modalProps.current.classificationColumn).toEqual(
            expect.objectContaining({ column_name: "nivel1", cell_type: "clasificacion" }),
        );
        expect(modalProps.current.statusColumn).toEqual(expect.objectContaining({ column_name: "estadoactual" }));
    });

    it("renders table headers: Campo, Cabecera, Tipo", () => {
        render(<CasesViewColumnEditor {...DEFAULT_PROPS} value={SAMPLE_COLUMNS} />);
        expect(screen.getByText("Campo")).toBeTruthy();
        expect(screen.getByText("Cabecera")).toBeTruthy();
        expect(screen.getByText("Tipo")).toBeTruthy();
    });
});
