import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MassiveExecutionInput from "./MassiveExecutionInput";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));

describe("MassiveExecutionInput - placeholder", () => {
    it("usa el placeholder traducido por defecto", () => {
        render(<MassiveExecutionInput />);

        expect(screen.getByPlaceholderText("massiveExecution.auxClient.valuePlaceholder")).toBeInTheDocument();
    });

    it("usa el placeholder recibido por prop", () => {
        render(<MassiveExecutionInput placeholder="Documento..." />);

        expect(screen.getByPlaceholderText("Documento...")).toBeInTheDocument();
    });
});
