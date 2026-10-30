import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import FormContent from "@kace_v2/shared/ui/molecules/FormContent";

/*
 * La flecha de volver tiene dos comportamientos y solo uno es correcto en cada caso: el
 * historial cuando el molecule no sabe a que modulo pertenece, y el destino que le pase el
 * formulario cuando si lo sabe. Si alguien invierte el `??`, los formularios que resuelven su
 * origen (tableros, via useBoardFormReturn) pasan a depender del historial.
 */

const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
    useNavigate: () => navigateMock,
}));

const backButton = () => screen.getByTestId("btn_back_form_card");

describe("FormContent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("vuelve al historial cuando no recibe onBack", () => {
        render(<FormContent title="Tablero" labelButton="Guardar" />);

        fireEvent.click(backButton());

        expect(navigateMock).toHaveBeenCalledWith(-1);
    });

    it("usa onBack en lugar del historial cuando el formulario lo aporta", () => {
        const onBack = vi.fn();
        render(<FormContent title="Tablero" labelButton="Guardar" onBack={onBack} />);

        fireEvent.click(backButton());

        expect(onBack).toHaveBeenCalledTimes(1);
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("no envia el formulario al pulsar volver", () => {
        render(<FormContent title="Tablero" labelButton="Guardar" />);

        expect(backButton()).toHaveAttribute("type", "button");
    });
});
