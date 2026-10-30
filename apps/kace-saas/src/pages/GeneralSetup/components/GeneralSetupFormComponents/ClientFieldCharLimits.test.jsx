import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Formik, useFormikContext } from "formik";
import i18n from "i18next";
import { joiFormikAdapter } from "@/utils/src/joiFormikAdapter";
import { GeneralSetupSchemaForm } from "@/schemas/GeneralSetupSchemaForm";
import { ClientFieldCharLimits } from "./ClientFieldCharLimits";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const ERROR_ID = "tab_agent_field_min_max_error_documento";
const MAX_BELOW_MIN = "El máximo no puede ser menor que el mínimo";
const NOT_INTEGER = "Debe ser un número entero";

// Exposes the validated keys so negative assertions run after validateOnMount settles
const ErrorsProbe = () => {
    const { errors } = useFormikContext();
    return <output data-testid="formik-errors">{Object.keys(errors).sort().join(",")}</output>;
};

const renderRow = ({ min = "", max = "", touched = {} } = {}) =>
    render(
        <Formik
            initialValues={{ field_documento_min: min, field_documento_max: max }}
            initialTouched={touched}
            validationSchema={joiFormikAdapter(GeneralSetupSchemaForm)}
            validateOnMount
            onSubmit={vi.fn()}
        >
            <>
                <ClientFieldCharLimits label="documento" />
                <ErrorsProbe />
            </>
        </Formik>,
    );

const minInput = () => screen.getByPlaceholderText("generalSetup.form.labels.min");
const maxInput = () => screen.getByPlaceholderText("generalSetup.form.labels.max");

describe("ClientFieldCharLimits", () => {
    beforeAll(async () => {
        await i18n.changeLanguage("es");
    });

    it("renders the field label and min/max inputs identified by their field name", () => {
        renderRow();

        expect(screen.getByText("generalSetup.form.labels.documento")).toBeInTheDocument();
        expect(minInput()).toHaveAttribute("id", "field_documento_min");
        expect(maxInput()).toHaveAttribute("id", "field_documento_max");
    });

    it("gives each input an accessible name with its field and bound", () => {
        renderRow();

        expect(
            screen.getByRole("spinbutton", {
                name: "generalSetup.form.labels.documento (generalSetup.form.labels.min)",
            }),
        ).toBe(minInput());
        expect(
            screen.getByRole("spinbutton", {
                name: "generalSetup.form.labels.documento (generalSetup.form.labels.max)",
            }),
        ).toBe(maxInput());
    });

    it("hides errors of untouched fields and leaves the inputs valid", async () => {
        renderRow({ min: 2.5, max: 1 });

        await waitFor(() => expect(screen.getByTestId("formik-errors")).toHaveTextContent("field_documento_min"));
        expect(screen.queryByTestId(ERROR_ID)).not.toBeInTheDocument();
        expect(maxInput()).toHaveAttribute("aria-invalid", "false");
        expect(minInput()).not.toHaveAttribute("aria-describedby");
    });

    it("shows touched errors of both fields and ties them to each input", async () => {
        renderRow({ min: 2.5, max: 7.5, touched: { field_documento_min: true, field_documento_max: true } });

        expect(await screen.findByTestId(ERROR_ID)).toHaveTextContent(`${NOT_INTEGER}. ${NOT_INTEGER}`);
        [minInput(), maxInput()].forEach((input) => {
            expect.soft(input).toHaveAttribute("aria-invalid", "true");
            expect.soft(input).toHaveAttribute("aria-describedby", ERROR_ID);
        });
    });

    it("shows the max/min error on the max once only the min is touched", async () => {
        renderRow({ min: 5, max: 2, touched: { field_documento_min: true } });

        expect(await screen.findByTestId(ERROR_ID)).toHaveTextContent(MAX_BELOW_MIN);
        expect(maxInput()).toHaveAttribute("aria-invalid", "true");
        expect(minInput()).toHaveAttribute("aria-invalid", "false");
    });

    it("keeps the max's own error hidden while only the min is touched", async () => {
        renderRow({ min: 5, max: 7.5, touched: { field_documento_min: true } });

        await waitFor(() => expect(screen.getByTestId("formik-errors")).toHaveTextContent("field_documento_max"));
        expect(screen.queryByTestId(ERROR_ID)).not.toBeInTheDocument();
        expect(maxInput()).toHaveAttribute("aria-invalid", "false");
    });

    it.each(["-5", "2.5", "1e2"])("ignores sign and decimal keys while typing %s", async (typed) => {
        renderRow();

        await userEvent.type(minInput(), typed);

        expect(minInput()).toHaveValue(Number(typed.replace(/[-.e]/g, "")));
    });

    it("ignores a pasted negative or decimal value", async () => {
        renderRow();

        await userEvent.click(minInput());
        await userEvent.paste("-3");
        await userEvent.paste("2.5");

        expect(minInput()).toHaveValue(null);
    });
});
