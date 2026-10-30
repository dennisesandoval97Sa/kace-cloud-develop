import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ReclassificationReason } from "./ReclassificationReason";

const longReason =
    "Una calurosa mañana, se encontraba Tío Conejo recolectando zanahorias para el almuerzo.\nDe repente, escuchó un rugido aterrador.";

describe("ReclassificationReason", () => {
    it("abre un modal con el motivo completo al hacer clic en el motivo truncado", async () => {
        render(<ReclassificationReason reason={longReason} />);

        expect(screen.queryByTestId("reclassification_reason_modal")).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId("reclassification_reason"));

        const modal = screen.getByTestId("reclassification_reason_modal");
        expect(modal).toBeInTheDocument();
        expect(screen.getByTestId("reclassification_reason_full")).toHaveTextContent(
            "Una calurosa mañana, se encontraba Tío Conejo recolectando zanahorias para el almuerzo. De repente, escuchó un rugido aterrador.",
        );
    });

    it("sin motivo muestra el texto por defecto sin abrir modal", async () => {
        render(<ReclassificationReason reason={null} />);

        const reason = screen.getByTestId("reclassification_reason");
        expect(reason.tagName).not.toBe("BUTTON");

        await userEvent.click(reason);

        expect(screen.queryByTestId("reclassification_reason_modal")).not.toBeInTheDocument();
    });
});
