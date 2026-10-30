import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import SwitchField from "@kace_v2/shared/ui/molecules/SwitchField";

describe("Switch field", () => {
    it("should render a switch with label", async () => {
        render(<SwitchField data-testid="testId" label="Status" id="status" />);
        const switchField = screen.getByRole("switch");
        const label = screen.getByTestId("input-field-status");
        expect(switchField).toBeInTheDocument();
        expect(label).toBeInTheDocument();
        expect(label.textContent).toBe("Status");
        expect(switchField).toHaveAttribute("role", "switch");
        expect(switchField).toHaveAttribute("aria-checked", "false");
        expect(switchField).toHaveAttribute("id", "status");
        await userEvent.click(switchField);
        expect(switchField).toHaveAttribute("aria-checked", "true");
    });

    it("should render a switch with error label", () => {
        render(<SwitchField label="Status" error="Status is required" />);
        const label = screen.getByTestId("input-field-status");
        const errorLabel = screen.getByTestId("input-field-error-status");
        expect(label).toBeInTheDocument();
        expect(errorLabel).toBeInTheDocument();
        expect(label.textContent).toBe("Status");
        expect(errorLabel.textContent).toBe("Status is required");
    });
});
