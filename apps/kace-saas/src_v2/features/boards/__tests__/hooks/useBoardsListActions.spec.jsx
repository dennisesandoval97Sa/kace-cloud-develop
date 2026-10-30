import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const navigateMock = vi.fn();
const deleteMock = vi.fn();
const downloadBoardExportMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => ({
    ...(await importOriginal()),
    useNavigate: () => navigateMock,
}));

vi.mock("@kace/hooks/useGeneralDelete", () => ({
    default: vi.fn(() => ({ mutate: deleteMock })),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@kace_v2/features/boards/utils/downloadBoardExport.util", () => ({
    downloadBoardExport: (...args) => downloadBoardExportMock(...args),
}));

import useGeneralDelete from "@kace/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useBoardsListActions = (await import("@kace_v2/features/boards/hooks/useBoardsListActions.hook")).default;

describe("useBoardsListActions — navegacion y borrado", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("abre el tablero", () => {
        const { result } = renderHook(() => useBoardsListActions());

        result.current.handleSeeBoard("board-1");

        expect(navigateMock).toHaveBeenCalledWith("/boards/board-1");
    });

    it("abre el formulario de edicion", () => {
        const { result } = renderHook(() => useBoardsListActions());

        result.current.handleUpdateBoard("board-1");

        expect(navigateMock).toHaveBeenCalledWith("/boards/update/board-1");
    });

    it("borra contra el endpoint de tableros", () => {
        const { result } = renderHook(() => useBoardsListActions());

        result.current.handleDeleteBoard("board-1");

        expect(deleteMock).toHaveBeenCalledWith({ id: "board-1", url: "/boards" });
        expect(useGeneralDelete).toHaveBeenCalledWith(expect.objectContaining({ keyQuery: URL_AND_KEYS.boards.key }));
    });
});

describe("useBoardsListActions — guarda de descarga", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /** Descarga que no termina hasta que se la resuelve a mano. */
    const pendingDownload = () => {
        let settle;
        downloadBoardExportMock.mockReturnValue(
            new Promise((resolve) => {
                settle = resolve;
            }),
        );
        return () => settle();
    };

    it("exporta el conjunto por defecto del tablero, sin criterio de pantalla", async () => {
        downloadBoardExportMock.mockResolvedValue(undefined);
        const { result } = renderHook(() => useBoardsListActions());

        await act(async () => {
            await result.current.handleDownloadBoard("board-1");
        });

        expect(downloadBoardExportMock).toHaveBeenCalledWith("board-1", {}, expect.any(Function));
    });

    it("descarta el segundo clic sobre el mismo tablero mientras la descarga sigue en vuelo", async () => {
        const finish = pendingDownload();
        const { result } = renderHook(() => useBoardsListActions());

        /*
         * Los dos clics salen en el mismo tick: es justo el caso que una guarda basada en
         * estado dejaria pasar, porque el re-render aun no ha ocurrido.
         */
        act(() => {
            result.current.handleDownloadBoard("board-1");
            result.current.handleDownloadBoard("board-1");
        });

        expect(downloadBoardExportMock).toHaveBeenCalledTimes(1);

        await act(async () => {
            finish();
        });
    });

    it("permite descargar otro tablero mientras el primero sigue en vuelo", async () => {
        const finish = pendingDownload();
        const { result } = renderHook(() => useBoardsListActions());

        act(() => {
            result.current.handleDownloadBoard("board-1");
            result.current.handleDownloadBoard("board-2");
        });

        expect(downloadBoardExportMock).toHaveBeenCalledTimes(2);

        await act(async () => {
            finish();
        });
    });

    it("libera la guarda cuando la descarga termina, tambien si fallo", async () => {
        downloadBoardExportMock.mockRejectedValueOnce(new Error("network down"));
        const { result } = renderHook(() => useBoardsListActions());

        await act(async () => {
            await result.current.handleDownloadBoard("board-1").catch(() => {});
        });

        downloadBoardExportMock.mockResolvedValue(undefined);
        await act(async () => {
            await result.current.handleDownloadBoard("board-1");
        });

        expect(downloadBoardExportMock).toHaveBeenCalledTimes(2);
    });
});
