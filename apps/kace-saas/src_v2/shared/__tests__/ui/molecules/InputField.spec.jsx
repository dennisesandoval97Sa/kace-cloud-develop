import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import InputField from "@kace_v2/shared/ui/molecules/InputField";

describe("Input field", () => {
    it("should render a input with label", async () => {
        render(<InputField data-testid="testId" label="Name" id="name" placeholder="User name" />);
        const input = screen.getByTestId("testId");
        const label = screen.getByTestId("input-field-name");
        expect(input).toBeInTheDocument();
        expect(label).toBeInTheDocument();
        expect(label.textContent).toBe("Name");
        expect(input).toHaveAttribute("placeholder", "User name");
        expect(input).toHaveAttribute("id", "name");
        await userEvent.type(input, "johnjoe@mail.com");
        expect(input).toHaveValue("johnjoe@mail.com");
    });

    it("should render a input with error label", () => {
        render(<InputField label="Name" error="Name is required" />);
        const label = screen.getByTestId("input-field-name");
        const errorLabel = screen.getByTestId("input-field-error-name");
        expect(label).toBeInTheDocument();
        expect(errorLabel).toBeInTheDocument();
        expect(label.textContent).toBe("Name");
        expect(errorLabel.textContent).toBe("Name is required");
    });
});
