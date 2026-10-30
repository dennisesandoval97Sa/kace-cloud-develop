import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuxDefinitionDynamicFilters } from "./AuxDefinitionDynamicFilters";

describe("AuxDefinitionDynamicFilters", () => {
    it("renders text filters with a stacked layout so long labels do not overlap inputs", () => {
        render(
            <AuxDefinitionDynamicFilters
                headers={[
                    {
                        label: "Auxcli Correo Actualizado",
                        nameColumn: "auxcli_correo_actualizado",
                        type: "string",
                    },
                ]}
                setFieldValue={vi.fn()}
                values={{}}
            />,
        );

        const input = screen.getByTestId("input_form_custom_auxcli_correo_actualizado");
        const fieldContainer = input.closest(".grid");

        expect(fieldContainer).toHaveClass("grid-cols-1");
        expect(input).toHaveClass("col-span-1");
    });
});
