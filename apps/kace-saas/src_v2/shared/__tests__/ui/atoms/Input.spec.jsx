import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Input from "@kace_v2/shared/ui/atoms/Input";

describe("Input", () => {
    it("should render a input with text type", () => {
        render(<Input type="text" data-testid="testId" />);
        const input = screen.getByTestId("testId");
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute("type", "text");
    });

    it("should render a input with number type", () => {
        render(<Input type="number" data-testid="testId" />);
        const input = screen.getByTestId("testId");
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute("type", "number");
    });
});
