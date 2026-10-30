import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";

Element.prototype.scrollIntoView = () => {};
Element.prototype.hasPointerCapture = () => false;

describe("Select field", () => {
    it("should render a select with label", async () => {
        render(
            <SelectField
                label="ANS"
                placeholder="Select..."
                options={[
                    { label: "One", value: "one" },
                    { label: "Two", value: "two" },
                    { label: "Three", value: "three" },
                ]}
            />,
        );
        const select = screen.getByTestId("select-trigger-ans");
        const label = screen.getByTestId("input-field-ans");
        expect(select).toBeInTheDocument();
        expect(label).toBeInTheDocument();
        expect(label.textContent).toBe("ANS");
        expect(select).toHaveAttribute("role", "combobox");
        await userEvent.click(select);
        expect(screen.getByTestId("select-option-one-one")).toBeInTheDocument();
        expect(screen.getByTestId("select-option-three-three")).toBeInTheDocument();
    });

    it("should render a select with error label", () => {
        render(<SelectField label="ANS" placeholder="Select..." error="Ans is required" />);
        const label = screen.getByTestId("input-field-ans");
        const errorLabel = screen.getByTestId("input-field-error-ans");
        expect(label).toBeInTheDocument();
        expect(errorLabel).toBeInTheDocument();
        expect(label.textContent).toBe("ANS");
        expect(errorLabel.textContent).toBe("Ans is required");
    });
});
