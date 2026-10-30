import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";

const exportBoardResources = vi.fn();
/*
 * `toast.promise` de sonner devuelve el id del toast con un `unwrap()` adjunto, no la
 * promesa: es la forma que hay que replicar para que el test valide lo que ocurre de verdad.
 */
const toastPromise = vi.fn((promise) => ({ unwrap: () => promise }));

vi.mock("@kace_v2/features/boards/services/boards.service", () => ({
    exportBoardResources: (...args) => exportBoardResources(...args),
}));

vi.mock("sonner", () => ({
    toast: { promise: (...args) => toastPromise(...args) },
}));

const { downloadBoardExport } = await import("@kace_v2/features/boards/utils/downloadBoardExport.util");

const t = (key) => key;

// El error que el toast habria pintado, tomado de la promesa que recibio.
const rejectionOf = () => expect(toastPromise.mock.calls[0][0]).rejects;

describe("downloadBoardExport", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.open = vi.fn();
    });

    it("abre la url prefirmada en una pestana nueva", async () => {
        exportBoardResources.mockResolvedValue({ data: { downloadUrl: "https://s3/export.xls" } });

        await downloadBoardExport("board-1", {}, t);

        expect(window.open).toHaveBeenCalledWith("https://s3/export.xls", "_blank", "noopener,noreferrer");
    });

    it("envia un criterio vacio cuando no se le pasa ninguno, para exportar el tablero completo", async () => {
        exportBoardResources.mockResolvedValue({ data: { downloadUrl: "https://s3/export.xls" } });

        await downloadBoardExport("board-1", undefined, t);

        expect(exportBoardResources).toHaveBeenCalledWith("board-1", {});
    });

    it("reenvia el criterio de pantalla cuando lo hay", async () => {
        exportBoardResources.mockResolvedValue({ data: { downloadUrl: "https://s3/export.xls" } });
        const criteria = { filter: [{ field: "estado", operator: "eq", value: "abierto" }] };

        await downloadBoardExport("board-1", criteria, t);

        expect(exportBoardResources).toHaveBeenCalledWith("board-1", criteria);
    });

    it("rechaza si la respuesta no trae url, para que el toast no anuncie un exito falso", async () => {
        exportBoardResources.mockResolvedValue({ data: {} });

        await downloadBoardExport("board-1", {}, t);

        await rejectionOf().toThrow("importExport.form.noRecords");
        expect(window.open).not.toHaveBeenCalled();
    });

    it("no abre una url que no sea https", async () => {
        exportBoardResources.mockResolvedValue({ data: { downloadUrl: "javascript:alert(1)" } });

        await downloadBoardExport("board-1", {}, t);

        await rejectionOf().toThrow("importExport.form.error");
        expect(window.open).not.toHaveBeenCalled();
    });

    it("espera a que termine la exportacion antes de resolver", async () => {
        let settle;
        exportBoardResources.mockReturnValue(
            new Promise((resolve) => {
                settle = () => resolve({ data: { downloadUrl: "https://s3/export.xls" } });
            }),
        );

        let done = false;
        const pending = downloadBoardExport("board-1", {}, t).then(() => {
            done = true;
        });

        await Promise.resolve();
        // Sin `unwrap()` el await resolvia de inmediato y los spinners no esperaban nada.
        expect(done).toBe(false);

        settle();
        await pending;
        expect(done).toBe(true);
    });

    /*
     * Sin mockear `@kace/error-codes`: el catalogo real es justo lo que hay que verificar,
     * porque el contrato es el codigo publicado, no un valor inventado en el test.
     */
    it("reconoce 'sin registros' por el codigo publico, en cualquiera de los dos envoltorios", async () => {
        exportBoardResources.mockRejectedValue({
            response: { data: { data: { code: PUBLIC_ERROR_CODES.BOARD_EXPORT_NO_RECORDS } } },
        });

        await downloadBoardExport("board-1", {}, t);

        await rejectionOf().toThrow("importExport.form.noRecords");
    });

    it("reconoce el codigo publico cuando llega en la raiz de la respuesta", async () => {
        exportBoardResources.mockRejectedValue({
            response: { data: { code: PUBLIC_ERROR_CODES.BOARD_EXPORT_NO_RECORDS } },
        });

        await downloadBoardExport("board-1", {}, t);

        await rejectionOf().toThrow("importExport.form.noRecords");
    });

    it("distingue 'sin registros' de un fallo generico", async () => {
        exportBoardResources.mockRejectedValue({
            response: { data: { errors: [{ message: 'No se encontraron registros en "casos"' }] } },
        });

        await downloadBoardExport("board-1", {}, t);

        await rejectionOf().toThrow("importExport.form.noRecords");
        expect(window.open).not.toHaveBeenCalled();
    });

    it("traduce un 403 a la falta de acceso al tablero", async () => {
        exportBoardResources.mockRejectedValue({ response: { status: 403, data: {} } });

        await downloadBoardExport("board-1", {}, t);

        await rejectionOf().toThrow("boards.list.noAccessToBoard");
    });

    it("traduce cualquier otro error al mensaje generico", async () => {
        exportBoardResources.mockRejectedValue(new Error("network down"));

        await downloadBoardExport("board-1", {}, t);

        await rejectionOf().toThrow("importExport.form.error");
    });

    it("no propaga el fallo al llamador, que solo tiene try/finally", async () => {
        exportBoardResources.mockRejectedValue(new Error("network down"));

        await expect(downloadBoardExport("board-1", {}, t)).resolves.toBeUndefined();
    });
});
