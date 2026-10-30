import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Label from "@kace_v2/shared/ui/atoms/Label";

describe("Label", () => {
    it("should render a label with htmlFor", () => {
        render(
            <Label htmlFor="name" data-testid="testId">
                Name
            </Label>,
        );
        const label = screen.getByTestId("testId");
        expect(label).toBeInTheDocument();
        expect(label).toHaveAttribute("for", "name");
    });
});
