/* eslint-disable react/prop-types */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DataTableFilterModal from "../../../ui/molecules/DataTableFilterModal";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: () => "Filter" }),
}));

vi.mock("@radix-ui/react-dialog", () => ({
    Dialog: ({ children }) => <div>{children}</div>,
    Portal: ({ children }) => <div>{children}</div>,
    Trigger: ({ children }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
    Filter: () => <span />,
    X: () => <span />,
}));

vi.mock("@kace_v2/shared/ui/atoms/Button", () => ({
    default: ({ children, ...props }) => <button {...props}>{children}</button>,
}));
vi.mock("@kace_v2/shared/ui/atoms/DialogOverlay", () => ({ default: () => <div /> }));
vi.mock("@kace_v2/shared/ui/atoms/DialogContent", () => ({
    default: ({ children, ...props }) => <div {...props}>{children}</div>,
}));
vi.mock("@kace_v2/shared/ui/atoms/DialogClose", () => ({
    default: ({ children }) => <div>{children}</div>,
}));
vi.mock("@kace_v2/shared/ui/atoms/DialogTitle", () => ({
    default: ({ children }) => <h1>{children}</h1>,
}));
vi.mock("@kace_v2/shared/ui/atoms/DialogDescription", () => ({
    default: ({ children }) => <p>{children}</p>,
}));
vi.mock("@kace_v2/shared/ui/molecules/DynamicInput", () => ({
    default: ({ onChange }) => (
        <button type="button" onClick={() => onChange("")}>
            Clear date
        </button>
    ),
}));

describe("DataTableFilterModal", () => {
    it("omits cleared date filters from the submitted array", async () => {
        const onSubmit = vi.fn();
        render(
            <DataTableFilterModal
                title="Filters"
                description="Filter records"
                fields={[{ name: "created_at", field: "created_at", label: "Created at", type: "date" }]}
                onSubmit={onSubmit}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
        fireEvent.click(screen.getByRole("button", { name: "Filter" }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([], expect.any(Object)));
    });
});
