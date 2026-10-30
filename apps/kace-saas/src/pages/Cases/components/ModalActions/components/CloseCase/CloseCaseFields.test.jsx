import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Formik } from "formik";
import { describe, expect, it, vi } from "vitest";
import { CloseCaseFields } from "./CloseCaseFields";
import { CLOSE_REASON_MAX_LENGTH } from "@/constants/closeReason";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const renderFields = (motivo_baja = "") =>
    render(
        <Formik initialValues={{ motivo_baja }} onSubmit={() => {}}>
            <CloseCaseFields />
        </Formik>,
    );

describe("CloseCaseFields character counter", () => {
    it("shows 0 / 5000 when the reason is empty and caps the textarea", () => {
        renderFields();

        expect(screen.getByTestId("textarea_discharge_counter")).toHaveTextContent(`0 / ${CLOSE_REASON_MAX_LENGTH}`);
        expect(screen.getByTestId("textarea_discharge_input")).toHaveAttribute(
            "maxLength",
            String(CLOSE_REASON_MAX_LENGTH),
        );
    });

    it("updates the counter as the user types", async () => {
        const user = userEvent.setup();
        renderFields();

        await user.type(screen.getByTestId("textarea_discharge_input"), "abc");

        expect(screen.getByTestId("textarea_discharge_counter")).toHaveTextContent(`3 / ${CLOSE_REASON_MAX_LENGTH}`);
    });
});
