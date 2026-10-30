import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { InputValueDepend } from "./InputValueDepend";
import { SPECIAL_FIELDS } from "../../../../../services/createSchemaFilter";

function NumberFieldHarness() {
    const { control, watch } = useForm({ defaultValues: { reference: "" } });
    const value = watch("reference");
    return (
        <>
            {InputValueDepend(SPECIAL_FIELDS.number, "reference", [], control)}
            <output data-testid="reference_value">{value}</output>
        </>
    );
}

describe("InputValueDepend number", () => {
    it("keeps only digits in numeric filter fields", async () => {
        const user = userEvent.setup();
        render(<NumberFieldHarness />);

        const input = screen.getByTestId("input_number_depend_reference");
        await user.type(input, "12ab3c!");

        expect(input).toHaveValue("123");
        expect(screen.getByTestId("reference_value")).toHaveTextContent("123");
    });
});
