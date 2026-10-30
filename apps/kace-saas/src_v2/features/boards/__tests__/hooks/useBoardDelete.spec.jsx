import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const navigateMock = vi.fn();
const deleteBoardMock = vi.fn();
const swalFireMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => ({
    ...(await importOriginal()),
    useNavigate: () => navigateMock,
    useParams: () => ({ id: "board-1" }),
    useLocation: () => ({ pathname: "/boards/board-1" }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("sweetalert2", () => ({
    default: { fire: (...args) => swalFireMock(...args) },
}));

vi.mock("@kace_v2/features/boards/hooks/useBoardsMutation.hook", () => ({
    default: () => ({ deleteBoard: deleteBoardMock, mutateBoard: vi.fn(), isPending: false }),
}));

vi.mock("@kace/hooks/useUserInformation", () => ({
    default: () => ({ permissionsAdmin: [] }),
}));

// El resto del hook (tabla, busquedas) no participa en el borrado; se neutraliza.
vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({ data: undefined, isLoading: false, isFetching: false, refetch: vi.fn() }),
}));

vi.mock("@kace_v2/shared/hooks/useSearch.hook", () => ({
    default: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@kace_v2/features/boards/hooks/useBoardTableState.hook", () => ({
    default: () => ({
        page: 1,
        setPage: vi.fn(),
        criteria: {},
        criteriaWithSort: {},
        filterFormValues: {},
        sortConfig: null,
        openFilterModal: false,
        setOpenFilterModal: vi.fn(),
        handleFilter: vi.fn(),
        handleSort: vi.fn(),
        clearFilters: vi.fn(),
    }),
}));

const useBoard = (await import("@kace_v2/features/boards/hooks/useBoard.hook")).default;

/** Confirma el dialogo y devuelve los callbacks con los que se invoco el borrado. */
const confirmDelete = async () => {
    swalFireMock.mockResolvedValueOnce({ isConfirmed: true });

    const { result } = renderHook(() => useBoard());
    await act(async () => {
        result.current.handleDelete();
    });

    return deleteBoardMock.mock.calls.at(-1)?.[1];
};

describe("useBoard — borrado del tablero", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("no borra nada si el usuario cancela la confirmacion", async () => {
        swalFireMock.mockResolvedValueOnce({ isConfirmed: false });

        const { result } = renderHook(() => useBoard());
        await act(async () => {
            result.current.handleDelete();
        });

        expect(deleteBoardMock).not.toHaveBeenCalled();
    });

    it("borra el tablero de la ruta al confirmar", async () => {
        await confirmDelete();

        expect(deleteBoardMock).toHaveBeenCalledWith("board-1", expect.any(Object));
    });

    it("vuelve al listado cuando el borrado termina bien, sin recarga dura", async () => {
        const callbacks = await confirmDelete();

        swalFireMock.mockResolvedValueOnce({});
        await act(async () => {
            callbacks.onSuccess();
        });

        // "/" redirigiria a /auth: el destino tiene que ser el listado.
        expect(navigateMock).toHaveBeenCalledWith("/boards");
    });

    it("no navega si el borrado falla", async () => {
        const callbacks = await confirmDelete();

        swalFireMock.mockResolvedValueOnce({});
        await act(async () => {
            callbacks.onError();
        });

        expect(navigateMock).not.toHaveBeenCalled();
        // El toast de error lo emite useGeneralDelete; este hook solo vuelve a habilitar las queries.
        expect(swalFireMock).toHaveBeenCalledTimes(1);
    });
});
