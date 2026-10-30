import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import useBoard from "@kace_v2/features/boards/hooks/useBoard.hook";
import useBoardsMutation from "@kace_v2/features/boards/hooks/useBoardsMutation.hook";
import { fetchBoard, fetchBoardResources } from "@kace_v2/features/boards/services/boards.service";
import { sendInformation } from "@/services/generic-send-information";
import { apiService } from "@/utils/main";
import { toast } from "sonner";

/*
 * A diferencia de useBoardsMutation.spec.jsx, aqui useGeneralDelete y useGeneralMutation NO se
 * mockean: son la capa donde vive el bug de invalidacion, asi que se ejercitan contra un QueryClient
 * real. El borrado tampoco se mockea a nivel de servicio: se corta en la capa HTTP (apiService) para
 * que deleteService.js entre en el test y el camino de fallo sea el mismo que en produccion.
 */

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    swalFire: vi.fn(),
}));

vi.mock("@kace_v2/features/boards/services/boards.service", () => ({
    fetchBoard: vi.fn(),
    fetchBoardResources: vi.fn(),
    fetchUsersByIds: vi.fn(),
    exportBoardResources: vi.fn(),
}));

// Solo se sustituye apiService: deleteService y useGeneralDelete corren de verdad.
vi.mock("@/utils/main", async (importOriginal) => ({
    ...(await importOriginal()),
    apiService: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/services/generic-send-information", () => ({ sendInformation: vi.fn() }));

vi.mock("react-redux", () => ({ useDispatch: () => vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => ({
    ...(await importOriginal()),
    useNavigate: () => mocks.navigate,
    useParams: () => ({ id: "board-1" }),
    useLocation: () => ({ pathname: "/boards/board-1" }),
}));

vi.mock("sweetalert2", () => ({ default: { fire: mocks.swalFire } }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), promise: vi.fn() } }));

vi.mock("@kace/plugins", async (importOriginal) => ({
    ...(await importOriginal()),
    Uuid: () => "00000000-0000-4000-8000-000000000000",
}));

const renderWithClient = (hook) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    return { queryClient, ...renderHook(hook, { wrapper }) };
};

describe("invalidacion de caché de boards contra un QueryClient real", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchBoard.mockResolvedValue({ id: "board-1", name: "Tablero", access_users: [] });
        fetchBoardResources.mockResolvedValue({ data: { items: [] }, metadata: {} });
        // El DELETE viaja como GET a `${url}/${id}/delete`; por defecto el backend responde 200.
        apiService.get.mockResolvedValue({ status: 200, data: {} });
        sendInformation.mockResolvedValue({ data: { data: { id: "board-1" } } });
        // Por defecto el usuario confirma el modal de borrado.
        mocks.swalFire.mockResolvedValue({ isConfirmed: true });
    });

    it("no refetchea el tablero borrado tras el DELETE", async () => {
        const { result } = renderWithClient(() => useBoard());

        await waitFor(() => expect(fetchBoard).toHaveBeenCalled());
        await waitFor(() => expect(fetchBoardResources).toHaveBeenCalled());

        const detailsCallsBeforeDelete = fetchBoard.mock.calls.length;
        const resourcesCallsBeforeDelete = fetchBoardResources.mock.calls.length;

        await act(async () => {
            result.current.handleDelete();
        });

        await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/boards"));

        expect(apiService.get).toHaveBeenCalledWith("/boards/board-1/delete");

        /*
         * useGeneralDelete invalida ["boards"] en su onSettled, que corre ANTES de este punto. Si las
         * queries del tablero siguieran habilitadas, la invalidacion las refetchearia contra un
         * tablero que ya no existe. Este test falla si se revierte el `!isDeleting` de useBoard.
         */
        expect(fetchBoard).toHaveBeenCalledTimes(detailsCallsBeforeDelete);
        expect(fetchBoardResources).toHaveBeenCalledTimes(resourcesCallsBeforeDelete);
    });

    /*
     * El fallo se fuerza donde ocurre en produccion: en la respuesta HTTP. deleteService lo propaga
     * como rechazo, asi que la mutacion entra en onError de verdad. Mientras el servicio se tragaba el
     * error y devolvia `false`, react-query lo tomaba por exito y este camino era inalcanzable.
     */
    it("mantiene habilitadas las queries si el borrado falla, para que se refresquen solas", async () => {
        apiService.get.mockRejectedValue(
            Object.assign(new Error("Request failed with status code 500"), {
                response: { status: 500, data: { message: "internal_error" } },
            }),
        );
        const { result } = renderWithClient(() => useBoard());

        await waitFor(() => expect(fetchBoard).toHaveBeenCalled());
        const detailsCallsBeforeDelete = fetchBoard.mock.calls.length;

        await act(async () => {
            result.current.handleDelete();
        });

        // La invalidacion dejo las queries stale: al re-habilitarlas vuelven a pedir datos.
        await waitFor(() => expect(fetchBoard.mock.calls.length).toBeGreaterThan(detailsCallsBeforeDelete));
        expect(mocks.navigate).not.toHaveBeenCalledWith("/");
        // El usuario se entera del fallo: sin la propagacion veria el toast de exito.
        expect(toast.error).toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
    });

    it("invalida el listado del sidebar al mutar un tablero", async () => {
        const fetchAvailable = vi.fn().mockResolvedValue([{ id: "board-1" }]);
        const { result, queryClient } = renderWithClient(() => useBoardsMutation(true));

        // Siembra la query del sidebar, la que alimentan useSubmenuBoards y useBoardsByGroup.
        await queryClient.fetchQuery({ queryKey: QUERY_KEYS.BOARDS.AVAILABLE, queryFn: fetchAvailable });
        expect(queryClient.getQueryState(QUERY_KEYS.BOARDS.AVAILABLE).isInvalidated).toBe(false);

        await act(async () => {
            await result.current.mutateBoard({ name: "Tablero", primary_entity: "cases" }, vi.fn(), vi.fn());
        });

        /*
         * additionalQueryKeys se pasa sin envolver, asi que es el unico canal por el que el sidebar se
         * entera: la key primaria llega envuelta (`[["boards","mutate"]]`) y no hace match con nada.
         * Este test falla si AVAILABLE se pasara con esa misma forma envuelta.
         */
        expect(queryClient.getQueryState(QUERY_KEYS.BOARDS.AVAILABLE).isInvalidated).toBe(true);
    });
});
