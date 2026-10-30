import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CombinedBulkActionsModal from "./CombinedBulkActionsModal";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));

const confirmButton = () => screen.getByRole("button", { name: "combinedBulkActions.buttons.confirm" });

const renderModal = (sections) =>
    render(
        <CombinedBulkActionsModal
            open
            onOpenChange={vi.fn()}
            onConfirm={vi.fn()}
            onRequestClose={vi.fn()}
            selectedCount={2}
            sections={sections}
        />,
    );

describe("CombinedBulkActionsModal confirm button", () => {
    it("is enabled when an action is selected and no section is invalid", () => {
        renderModal([
            {
                key: "reassign",
                label: "Reassign",
                enabled: true,
                content: <div />,
            },
        ]);

        expect(confirmButton()).toBeEnabled();
    });

    it("is disabled when an enabled section has a frontend validation error", () => {
        renderModal([
            {
                key: "close",
                label: "Close",
                enabled: true,
                isInvalid: true,
                content: <div>close fields</div>,
            },
        ]);

        expect(confirmButton()).toBeDisabled();
        expect(screen.getByRole("alert")).toHaveTextContent("combinedBulkActions.fixInvalidSections");
        expect(screen.getByTestId("bulk-section-close")).toHaveAttribute("aria-invalid", "true");
    });

    it("is disabled when any enabled section is invalid even if another is valid", () => {
        renderModal([
            {
                key: "reassign",
                label: "Reassign",
                enabled: true,
                isInvalid: false,
                content: <div />,
            },
            {
                key: "close",
                label: "Close",
                enabled: true,
                isInvalid: true,
                content: <div />,
            },
        ]);

        expect(confirmButton()).toBeDisabled();
    });
});
