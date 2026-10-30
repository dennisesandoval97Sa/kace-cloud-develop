import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextAreaForm } from "./TextAreaForm";

const errorCopy = "Cannot start or end with empty spaces, Invalid characters";

describe("TextAreaForm label and error layout", () => {
    it("stacks the label above the error so they do not share a horizontal row", () => {
        render(
            <TextAreaForm
                name="motivo_baja"
                label="Description"
                field={{ name: "motivo_baja" }}
                meta={{ touched: true, error: errorCopy }}
                id="textarea_discharge"
                errorLayout="stacked"
            />,
        );

        const header = screen.getByTestId("textarea_discharge_label").parentElement;
        expect(header.className).toMatch(/flex-col/);
        expect(screen.getByTestId("textarea_discharge_error")).toHaveTextContent(errorCopy);
    });

    it("keeps the default error layout inline", () => {
        render(
            <TextAreaForm
                name="motivo_baja"
                label="Description"
                field={{ name: "motivo_baja" }}
                meta={{ touched: true, error: errorCopy }}
                id="textarea_discharge"
            />,
        );

        expect(screen.getByTestId("textarea_discharge_label").parentElement.className).toMatch(/justify-between/);
    });

    it("shows the error when forceShowError is set even if the field is not touched", () => {
        render(
            <TextAreaForm
                name="motivo_baja"
                label="Description"
                field={{ name: "motivo_baja" }}
                meta={{ touched: false, error: "Invalid characters" }}
                forceShowError
                id="textarea_discharge"
                errorLayout="stacked"
            />,
        );

        expect(screen.getByTestId("textarea_discharge_error")).toHaveTextContent("Invalid characters");
        expect(screen.getByTestId("textarea_discharge_input")).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByTestId("textarea_discharge_input")).toHaveAttribute(
            "aria-describedby",
            "textarea_discharge_error",
        );
        expect(screen.getByRole("alert")).toHaveTextContent("Invalid characters");
    });
});
