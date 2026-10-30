import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import BoardCasesBulkCombinedModal from "./BoardCasesBulkCombinedModal";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));

const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    selectedCount: 2,
    canClose: true,
    canReassign: false,
    canChangeState: false,
    handleAssignSubmit: vi.fn(),
    handleTransitionSubmit: vi.fn(),
    handleCloseSubmit: vi.fn(),
    invalidateBoardResources: vi.fn(),
    clearSelection: vi.fn(),
};

describe("BoardCasesBulkCombinedModal close gating", () => {
    it("disables Confirm while the close reason is empty and enables it once valid", async () => {
        const user = userEvent.setup();
        render(<BoardCasesBulkCombinedModal {...baseProps} />);
        await user.click(screen.getByLabelText("combinedBulkActions.closeCheckboxLabel"));
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "combinedBulkActions.buttons.confirm" })).toBeDisabled(),
        );
        await user.type(screen.getByTestId("board_close_reason_input"), "Motivo válido de cierre");
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "combinedBulkActions.buttons.confirm" })).toBeEnabled(),
        );
    });
});
