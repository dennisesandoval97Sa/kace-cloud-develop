import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockGetSchemaField = vi.fn();

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({
        getSchemaField: mockGetSchemaField,
    }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, fallback) => fallback || key }),
}));

vi.mock("@/components/ui-shared", () => ({
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock("@/componentsV2/core/DataTable/components/DataTableFilterInputs", () => ({
    default: ({ label, name, handle, value }) => (
        <div data-testid={`filter-input-${name}`}>
            <label htmlFor={name}>{label}</label>
            <input
                id={name}
                data-testid={`input-${name}`}
                value={value?.value || ""}
                onChange={(e) =>
                    handle(name, {
                        field: `clients.${name}`,
                        operator: "ilike",
                        type: "AND",
                        value: e.target.value,
                    })
                }
            />
        </div>
    ),
}));

const { default: DataTableEntityFilter } = await import("./DataTableEntityFilter");

describe("DataTableEntityFilter in MassiveExecutionClientTab", () => {
    const mockSchema = [
        { column_name: "id", data_type: "string", label: "id" },
        { column_name: "documento", data_type: "string", label: "documento" },
        { column_name: "nombres", data_type: "string", label: "nombres" },
        { column_name: "tipo_cliente", data_type: "string", label: "tipo_cliente" },
        { column_name: "tipo_documento", data_type: "string", label: "tipo_documento" },
        { column_name: "status", data_type: "integer", label: "status" },
        { column_name: "created_by", data_type: "string", label: "created_by" },
        { column_name: "updated_by", data_type: "string", label: "updated_by" },
        { column_name: "deleted_by", data_type: "string", label: "deleted_by" },
        { column_name: "created_at", data_type: "timestamp", label: "created_at" },
        { column_name: "updated_at", data_type: "timestamp", label: "updated_at" },
        { column_name: "deleted_at", data_type: "timestamp", label: "deleted_at" },
    ];

    const excludeColumns = [
        "id",
        "created_by",
        "deleted_by",
        "updated_by",
        "created_at",
        "deleted_at",
        "updated_at",
        "status",
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSchemaField.mockReturnValue(mockSchema);
    });

    it("does not render inputs for excluded audit columns and status", () => {
        render(<DataTableEntityFilter excludeColumns={excludeColumns} fieldPrefix="clients." />);

        expect(screen.queryByTestId("filter-input-status")).toBeNull();
        expect(screen.queryByTestId("filter-input-id")).toBeNull();
        expect(screen.queryByTestId("filter-input-created_by")).toBeNull();
        expect(screen.queryByTestId("filter-input-created_at")).toBeNull();

        expect(screen.getByTestId("filter-input-documento")).toBeDefined();
        expect(screen.getByTestId("filter-input-nombres")).toBeDefined();
        expect(screen.getByTestId("filter-input-tipo_cliente")).toBeDefined();
        expect(screen.getByTestId("filter-input-tipo_documento")).toBeDefined();
    });

    it("emits qualified client filters when submitting active values", async () => {
        const onApply = vi.fn();
        render(<DataTableEntityFilter onApply={onApply} excludeColumns={excludeColumns} fieldPrefix="clients." />);

        const docInput = screen.getByTestId("input-documento");
        fireEvent.change(docInput, { target: { value: "12345" } });

        const filterBtn = screen.getByText("massiveExecution.button.filter");
        fireEvent.click(filterBtn);

        await waitFor(() => {
            expect(onApply).toHaveBeenCalledWith([
                expect.objectContaining({
                    field: "clients.documento",
                    value: "12345",
                }),
            ]);
        });
    });
});
