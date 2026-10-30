import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Formik } from "formik";
import { describe, expect, it, vi } from "vitest";
import { SimpleSelect } from "./SimpleSelect";

Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => {} },
    scrollIntoView: { configurable: true, value: () => {} },
    setPointerCapture: { configurable: true, value: () => {} },
});

const options = [
    { value: "subject", label: "Subject" },
    { value: "body", label: "Body" },
];

const renderSimpleSelect = ({ initialValues = { rules: [{ field: "" }] }, ...props } = {}) => {
    let formik;
    render(
        <Formik initialValues={initialValues} onSubmit={vi.fn()}>
            {(formikProps) => {
                formik = formikProps;
                return <SimpleSelect name="rules.0.field" options={options} placeholder="Pick a field" {...props} />;
            }}
        </Formik>,
    );

    return { getValues: () => formik.values };
};

describe("SimpleSelect", () => {
    it("shows the placeholder when the nested field is empty", () => {
        renderSimpleSelect();

        expect(screen.getByRole("combobox")).toHaveTextContent("Pick a field");
    });

    it("shows the label of the nested field value", () => {
        renderSimpleSelect({ initialValues: { rules: [{ field: "body" }] } });

        expect(screen.getByRole("combobox")).toHaveTextContent("Body");
    });

    it("sets the field value and notifies onChange when an option is chosen", async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        const { getValues } = renderSimpleSelect({ onChange });

        await user.click(screen.getByRole("combobox"));
        await user.click(await screen.findByRole("option", { name: "Subject" }));

        expect(getValues().rules[0].field).toBe("subject");
        expect(onChange).toHaveBeenCalledWith("subject");
        expect(screen.getByRole("combobox")).toHaveTextContent("Subject");
    });

    it("merges a className with the trigger size and forwards the remaining props to the trigger", () => {
        renderSimpleSelect({ className: "border-red-600", "aria-label": "Field 1", "aria-invalid": true });

        const trigger = screen.getByRole("combobox", { name: "Field 1" });
        expect(trigger).toHaveClass("w-full", "h-10", "border-red-600");
        expect(trigger).toHaveAttribute("aria-invalid", "true");
    });
});
