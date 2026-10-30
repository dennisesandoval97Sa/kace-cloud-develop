import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FieldWrapper from "./FieldWrapper";

describe("FieldWrapper label and error layout", () => {
    it("stacks the label above the error so they do not collide on one row", () => {
        render(
            <FieldWrapper label="Description" error="Cannot start or end with empty spaces, Invalid characters">
                <textarea />
            </FieldWrapper>,
        );

        const header = screen.getByTestId("input-field-description").parentElement;
        expect(header.className).toMatch(/flex-col/);
        expect(screen.getByTestId("input-field-error-description")).toHaveTextContent(
            "Cannot start or end with empty spaces, Invalid characters",
        );
    });
});
