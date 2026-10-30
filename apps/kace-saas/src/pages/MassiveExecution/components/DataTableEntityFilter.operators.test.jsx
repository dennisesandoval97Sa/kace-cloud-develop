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
    default: ({ name, handle, value, filterData }) => (
        <input
            data-testid={`input-${name}`}
            value={value?.value || ""}
            onChange={(e) =>
                handle(name, {
                    ...filterData,
                    value: e.target.value,
                })
            }
        />
    ),
}));

const { default: DataTableEntityFilter } = await import("./DataTableEntityFilter");

describe("DataTableEntityFilter operators", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSchemaField.mockReturnValue([
            { column_name: "padre_id", data_type: "string", label: "Parent ID" },
            { column_name: "nombres", data_type: "string", label: "nombres" },
        ]);
    });

    it("emits eq for UUID id columns and ilike for text columns", async () => {
        const onApply = vi.fn();
        render(<DataTableEntityFilter onApply={onApply} fieldPrefix="clients." />);

        fireEvent.change(screen.getByTestId("input-padre_id"), { target: { value: "parent-uuid" } });
        fireEvent.change(screen.getByTestId("input-nombres"), { target: { value: "Ana" } });
        fireEvent.click(screen.getByText("massiveExecution.button.filter"));

        await waitFor(() => {
            expect(onApply).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: "clients.padre_id",
                        operator: "eq",
                        value: "parent-uuid",
                    }),
                    expect.objectContaining({
                        field: "clients.nombres",
                        operator: "ilike",
                        value: "Ana",
                    }),
                ]),
            );
        });
    });
});
