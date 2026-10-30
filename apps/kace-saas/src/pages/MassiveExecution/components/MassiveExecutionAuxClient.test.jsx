import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MassiveExecutionAuxClient from "./MassiveExecutionAuxClient";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
vi.mock("@/pages/MassiveExecution/hooks/useMassiveExecutionClients", () => ({
    default: () => ({
        loading: false,
        clientRoutesOptions: {
            routes: [{ id: "r1", label: "datos" }],
            fields: [{ id: "f1", label: "ciudad", routeId: "r1" }],
        },
    }),
}));

const selectRoute = () => {
    fireEvent.click(screen.getByText("massiveExecution.auxClient.selectOption"));
    fireEvent.click(screen.getByText("datos"));
};

// Tras elegir la ruta, el único selector sin valor es el de campo.
const addFilter = (value) => {
    fireEvent.click(screen.getByText("massiveExecution.auxClient.selectOption"));
    fireEvent.click(screen.getByText("ciudad"));
    fireEvent.change(screen.getByPlaceholderText("massiveExecution.auxClient.valuePlaceholder"), {
        target: { value },
    });
    fireEvent.click(screen.getByRole("button", { name: "massiveExecution.auxClient.add" }));
};

describe("MassiveExecutionAuxClient - propagación de criterios al padre", () => {
    beforeAll(() => {
        // jsdom no implementa scrollIntoView, que usa el listado del Command.
        Element.prototype.scrollIntoView = vi.fn();
    });

    it("emite el criterio vacío una sola vez al montar", () => {
        const onChange = vi.fn();
        render(<MassiveExecutionAuxClient onChange={onChange} />);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({});
    });

    it("entrega los criterios vigentes al nuevo onChange cuando el padre cambia la referencia", () => {
        const firstOnChange = vi.fn();
        const secondOnChange = vi.fn();
        const { rerender } = render(<MassiveExecutionAuxClient onChange={firstOnChange} />);
        selectRoute();
        addFilter("Bogota");

        rerender(<MassiveExecutionAuxClient onChange={secondOnChange} />);

        expect(firstOnChange).toHaveBeenLastCalledWith({ ciudad: "Bogota" });
        expect(secondOnChange).toHaveBeenCalledTimes(1);
        expect(secondOnChange).toHaveBeenCalledWith({ ciudad: "Bogota" });
    });
});
