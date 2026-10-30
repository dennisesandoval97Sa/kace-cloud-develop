import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { BOARDS_DEFAULT_PAGE_SIZE } from "@kace_v2/features/boards/constants/boards.constants";

const mutateMock = vi.fn();
const deleteMock = vi.fn();
const navigateMock = vi.fn();
const useGeneralMutationMock = vi.fn(() => ({ mutate: mutateMock, isPending: false }));
const useGeneralDeleteMock = vi.fn(() => ({ mutate: deleteMock }));

vi.mock("@kace/hooks/useGeneralMutation", () => ({
    default: (options) => useGeneralMutationMock(options),
}));

vi.mock("@kace/hooks/useGeneralDelete", () => ({
    default: (options) => useGeneralDeleteMock(options),
}));

/*
 * useLocation tambien se mockea: useBoardFormReturn lo consume y el real revienta fuera de un
 * <Router>. `locationState` es el origen marcado en cada caso.
 */
let locationState = null;

vi.mock("react-router-dom", async (importOriginal) => ({
    ...(await importOriginal()),
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: locationState }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

/*
 * genericHandleSendInformation se usa real: formatDataBeforePost descarta los null y es justo lo que
 * las correcciones de orders/display_order del hook existen para compensar. Solo se aisla el Uuid, que
 * es lo unico no determinista del formateo.
 */
vi.mock("@kace/plugins", async (importOriginal) => ({
    ...(await importOriginal()),
    Uuid: () => "00000000-0000-4000-8000-000000000000",
}));

const useBoardsMutation = (await import("@kace_v2/features/boards/hooks/useBoardsMutation.hook")).default;

const baseValues = {
    id: "00000000-0000-4000-8000-000000000000",
    name: "Tablero",
    description: "Descripcion",
    primary_entity: "cases",
    page_size: 25,
    columns: [{ alias: "col" }],
    criteria: { items: [{}] },
};

/** Ejecuta el hook y devuelve el payload que recibio la mutacion. */
const submit = async (values) => {
    const { result } = renderHook(() => useBoardsMutation(true));
    await act(async () => {
        await result.current.mutateBoard({ ...baseValues, ...values }, vi.fn(), vi.fn());
    });
    return mutateMock.mock.calls.at(-1)[0].dataPost;
};

describe("useBoardsMutation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        locationState = null;
        mutateMock.mockResolvedValue({ data: { data: { id: "board-1" } } });
    });

    it("invalida el listado del sidebar en cada mutacion de tablero", () => {
        renderHook(() => useBoardsMutation());

        expect(useGeneralMutationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                keyQuery: URL_AND_KEYS.boards.key,
                additionalQueryKeys: [QUERY_KEYS.BOARDS.AVAILABLE],
            }),
        );
    });

    it("borra con el prefijo de boards y no con la key de ANS", () => {
        renderHook(() => useBoardsMutation());

        expect(useGeneralDeleteMock).toHaveBeenCalledWith(
            expect.objectContaining({ keyQuery: QUERY_KEYS.BOARDS.ROOT_KEY }),
        );
    });

    it("delega el feedback del borrado en los toast de nivel mutacion", () => {
        renderHook(() => useBoardsMutation());

        expect(useGeneralDeleteMock).toHaveBeenCalledWith(
            expect.objectContaining({
                successMessage: "boards.boardView.deleteBoardSuccessText",
                errorMessage: "boards.boardView.deleteBoardErrorText",
            }),
        );
    });

    it("navega al tablero creado con el id devuelto por el servidor", async () => {
        const { result } = renderHook(() => useBoardsMutation());

        await act(async () => {
            await result.current.mutateBoard({ name: "Tablero nuevo" });
        });

        expect(navigateMock).toHaveBeenCalledWith("/boards/board-1");
    });

    /*
     * Tras editar ya no se hace `navigate(-1)`: el historial no siempre tiene detras el origen
     * (abrir la edicion por enlace directo sacaba de la aplicacion). Se va a la ruta marcada.
     */
    it("vuelve al origen marcado cuando la mutacion es de actualizacion", async () => {
        locationState = { boardReturnTo: "/boards/board-1" };
        const { result } = renderHook(() => useBoardsMutation(true));

        await act(async () => {
            await result.current.mutateBoard({ name: "Tablero editado" });
        });

        expect(navigateMock).toHaveBeenCalledWith("/boards/board-1", { replace: true });
    });

    it("vuelve al listado tras editar cuando no hay origen marcado", async () => {
        const { result } = renderHook(() => useBoardsMutation(true));

        await act(async () => {
            await result.current.mutateBoard({ name: "Tablero editado" });
        });

        expect(navigateMock).toHaveBeenCalledWith("/boards", { replace: true });
    });

    it("goBackFromForm sale al origen marcado reemplazando la entrada del historial", () => {
        locationState = { boardReturnTo: "/boards/board-1" };
        const { result } = renderHook(() => useBoardsMutation(true));

        act(() => result.current.goBackFromForm());

        expect(navigateMock).toHaveBeenCalledWith("/boards/board-1", { replace: true });
    });

    it("vuelve al listado si la respuesta no trae id, en vez de a la raiz que redirige a /auth", async () => {
        mutateMock.mockResolvedValue({ data: {} });
        const { result } = renderHook(() => useBoardsMutation());

        await act(async () => {
            await result.current.mutateBoard({ name: "Sin id" });
        });

        expect(navigateMock).toHaveBeenCalledWith("/boards");
    });

    it("borra el tablero contra el endpoint de boards", () => {
        const { result } = renderHook(() => useBoardsMutation());

        act(() => result.current.deleteBoard("board-1"));

        expect(deleteMock).toHaveBeenCalledWith(
            { id: "board-1", url: URL_AND_KEYS.boards.url },
            { onSuccess: expect.any(Function), onError: undefined },
        );
    });

    it("reenvia onSuccess al llamador cuando el DELETE responde true", () => {
        const { result } = renderHook(() => useBoardsMutation());
        const callbacks = { onSuccess: vi.fn(), onError: vi.fn() };

        result.current.deleteBoard("board-1", callbacks);
        deleteMock.mock.calls.at(-1)[1].onSuccess(true);

        expect(callbacks.onSuccess).toHaveBeenCalled();
        expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it("trata un DELETE que resuelve false como error", () => {
        const { result } = renderHook(() => useBoardsMutation());
        const callbacks = { onSuccess: vi.fn(), onError: vi.fn() };

        result.current.deleteBoard("board-1", callbacks);
        deleteMock.mock.calls.at(-1)[1].onSuccess(false);

        expect(callbacks.onError).toHaveBeenCalled();
        expect(callbacks.onSuccess).not.toHaveBeenCalled();
    });

    it("propaga el onError del borrado al llamador", () => {
        const { result } = renderHook(() => useBoardsMutation());
        const callbacks = { onSuccess: vi.fn(), onError: vi.fn() };

        result.current.deleteBoard("board-1", callbacks);
        deleteMock.mock.calls.at(-1)[1].onError();

        expect(callbacks.onError).toHaveBeenCalled();
    });

    describe("normalizacion de page_size antes de enviarlo al API", () => {
        const getSentPageSize = () => mutateMock.mock.calls.at(-1)[0].dataPost.page_size;

        it.each([
            ["undefined", undefined, BOARDS_DEFAULT_PAGE_SIZE],
            ["cadena vacia", "", BOARDS_DEFAULT_PAGE_SIZE],
            ["texto no numerico", "abc", BOARDS_DEFAULT_PAGE_SIZE],
            ["cadena numerica", "25", 25],
            ["numero", 25, 25],
        ])("convierte %s en %s", async (_caso, page_size, expected) => {
            const { result } = renderHook(() => useBoardsMutation());

            await act(async () => {
                await result.current.mutateBoard({ name: "Tablero", page_size });
            });

            expect(getSentPageSize()).toBe(expected);
        });
    });
});

describe("useBoardsMutation — display_order", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        locationState = null;
    });

    it("sends null when the user clears the display order", async () => {
        const dataPost = await submit({ display_order: "" });
        expect(dataPost).toHaveProperty("display_order", null);
    });

    it("sends null when the board never had a display order", async () => {
        const dataPost = await submit({});
        expect(dataPost).toHaveProperty("display_order", null);
    });

    it("sends the display order as a number when the input provides a string", async () => {
        const dataPost = await submit({ display_order: "3" });
        expect(dataPost.display_order).toBe(3);
    });

    it("keeps a numeric display order untouched", async () => {
        const dataPost = await submit({ display_order: 7 });
        expect(dataPost.display_order).toBe(7);
    });

    it("falls back to the default page size when page_size is cleared", async () => {
        const dataPost = await submit({ page_size: "" });
        expect(dataPost.page_size).toBe(25);
    });

    it("sends null orders so clearing the board order reaches the server", async () => {
        const dataPost = await submit({ orders: [] });
        expect(dataPost).toHaveProperty("orders", null);
    });
});

describe("useBoardsMutation — creacion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        locationState = null;
    });

    /** Ejecuta la rama de creacion resolviendo la mutacion con la respuesta indicada. */
    const create = async (response) => {
        mutateMock.mockResolvedValue(response);

        const { result } = renderHook(() => useBoardsMutation(false));
        await act(async () => {
            await result.current.mutateBoard(baseValues, vi.fn(), vi.fn());
        });
    };

    it("pide al backend que genere el id, que en creacion no lo trae el formulario", async () => {
        await create({ data: { data: { id: "board-nuevo" } } });

        expect(mutateMock.mock.calls.at(-1)[0].options).toMatchObject({ serverGeneratedId: true });
    });

    it("navega al detalle del tablero recien creado", async () => {
        await create({ data: { data: { id: "board-nuevo" } } });

        expect(navigateMock).toHaveBeenCalledWith("/boards/board-nuevo");
    });

    it("acepta tambien el id sin el envoltorio extra de la respuesta", async () => {
        await create({ data: { id: "board-nuevo" } });

        expect(navigateMock).toHaveBeenCalledWith("/boards/board-nuevo");
    });

    it("vuelve al listado si la respuesta no trae id, en vez de a la raiz que redirige a /auth", async () => {
        await create({ data: {} });

        expect(navigateMock).toHaveBeenCalledWith("/boards");
    });
});
