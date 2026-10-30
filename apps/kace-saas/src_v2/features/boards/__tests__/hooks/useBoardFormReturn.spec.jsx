import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/*
 * A la edicion de un tablero se llega desde el listado y desde los registros del tablero, y
 * la URL es la misma en los dos casos: el origen viaja en `location.state`. Si se pierde, el
 * usuario vuelve al listado desde una vista a la que deberia regresar.
 */

const locationMock = vi.fn();

vi.mock("react-router-dom", () => ({
    useLocation: () => locationMock(),
}));

const {
    default: useBoardFormReturn,
    boardReturnStateTo,
    resolveBoardFormReturn,
    BOARDS_LIST_ROUTE,
} = await import("@kace_v2/features/boards/hooks/useBoardFormReturn.hook");

/** Resuelve el destino como lo hace el formulario, con el state indicado en la ruta. */
const returnRouteFor = (state) => {
    locationMock.mockReturnValue({ state });
    return renderHook(() => useBoardFormReturn()).result.current;
};

describe("useBoardFormReturn", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("vuelve al origen que marco quien abrio el formulario", () => {
        expect(returnRouteFor({ boardReturnTo: "/boards/board-1" })).toBe("/boards/board-1");
    });

    it.each([
        ["sin state, como al entrar por URL directa", null],
        ["con state vacio", {}],
        ["cuando el origen no es una cadena", { boardReturnTo: 42 }],
    ])("vuelve al listado %s", (_caso, state) => {
        expect(returnRouteFor(state)).toBe(BOARDS_LIST_ROUTE);
    });

    /*
     * Mismo saneado que useBoardCaseReturn: un origen que el navegador leeria como host
     * externo convertiria la flecha de volver en un redirect abierto.
     */
    it.each(["//evil.example.com", "/\\evil.example.com", "https://evil.example.com/boards", "boards/board-1"])(
        "descarta el origen %s y vuelve al listado",
        (boardReturnTo) => {
            expect(returnRouteFor({ boardReturnTo })).toBe(BOARDS_LIST_ROUTE);
        },
    );

    it("resuelve el state que escribe quien navega al formulario", () => {
        /*
         * Ida y vuelta: ata la clave que escribe `boardReturnStateTo` con la que lee el hook,
         * para que renombrarla en un solo lado rompa el test y no el flujo.
         */
        const { state } = boardReturnStateTo("/boards/board-1");

        expect(resolveBoardFormReturn(state)).toBe("/boards/board-1");
        expect(returnRouteFor(state)).toBe("/boards/board-1");
    });
});
