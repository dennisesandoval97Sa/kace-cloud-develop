import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userInformationMock = vi.fn(() => ({ user: { id: "u1" }, active_group_id: "g1" }));

vi.mock("@kace/hooks/useUserInformation", () => ({
    default: () => userInformationMock(),
}));

const { readPersisted, writePersisted } = await import("@kace_v2/shared/utils/persistentStorage.util");
const { BOARD_TABLE_SCOPE } = await import("@kace_v2/features/boards/constants/boardTableScope.constants");
const { default: useBoardTableState, buildBoardStateNamespace } = await import("../../hooks/useBoardTableState.hook");

const SCOPE = { userId: "u1", groupId: "g1" };
const namespaceFor = (boardId) => buildBoardStateNamespace(BOARD_TABLE_SCOPE.AGENT, boardId);

const buildCriteria = (value) => ({
    filter: [{ field: "cases.subject", operator: "ilike", type: "AND", value }],
    limit: 0,
    offset: 0,
});

const seedBoard = (boardId, value) =>
    writePersisted(
        namespaceFor(boardId),
        { criteria: buildCriteria(value), filterFormValues: { subject: { value } } },
        SCOPE,
    );

const renderBoardState = (boardId) =>
    renderHook(({ id }) => useBoardTableState(id, { scope: BOARD_TABLE_SCOPE.AGENT }), {
        initialProps: { id: boardId },
    });

beforeEach(() => {
    userInformationMock.mockReturnValue({ user: { id: "u1" }, active_group_id: "g1" });
});

describe("useBoardTableState", () => {
    it("arranca vacio cuando no hay nada persistido", () => {
        const { result } = renderBoardState("board-a");
        expect(result.current.criteria).toEqual({});
        expect(result.current.page).toBe(1);
        expect(result.current.openFilterModal).toBe(false);
    });

    it("restaura el criterio persistido en el primer render", () => {
        seedBoard("board-a", "hola");

        const seen = [];
        renderHook(() => {
            const state = useBoardTableState("board-a", { scope: BOARD_TABLE_SCOPE.AGENT });
            seen.push(state.criteria);
            return state;
        });

        expect(seen[0]).toEqual(buildCriteria("hola"));
    });

    it("no borra el criterio restaurado en la pasada de efectos del montaje", () => {
        seedBoard("board-a", "hola");
        const { result } = renderBoardState("board-a");
        expect(result.current.criteria).toEqual(buildCriteria("hola"));
        expect(readPersisted(namespaceFor("board-a"), SCOPE)).toBeDefined();
    });

    it("persiste el filtro aplicado junto con los valores del formulario", () => {
        const { result } = renderBoardState("board-a");
        const formValues = { subject: { field: "cases.subject", operator: "ilike", type: "AND", value: "x" } };

        act(() => result.current.handleFilter(Object.values(formValues), formValues));

        expect(readPersisted(namespaceFor("board-a"), SCOPE)).toEqual({
            criteria: { filter: Object.values(formValues), limit: 0, offset: 0 },
            filterFormValues: formValues,
        });
    });

    it("borra el snapshot al limpiar filtros", () => {
        seedBoard("board-a", "hola");
        const { result } = renderBoardState("board-a");

        act(() => result.current.clearFilters());

        expect(result.current.criteria).toEqual({});
        expect(result.current.filterFormValues).toEqual({});
        expect(readPersisted(namespaceFor("board-a"), SCOPE)).toBeUndefined();
    });

    it("aisla el estado entre tableros", () => {
        seedBoard("board-a", "de-a");
        seedBoard("board-b", "de-b");

        const { result: a } = renderBoardState("board-a");
        const { result: b } = renderBoardState("board-b");

        expect(a.current.criteria).toEqual(buildCriteria("de-a"));
        expect(b.current.criteria).toEqual(buildCriteria("de-b"));
    });

    it("al cambiar de tablero carga el snapshot del nuevo en vez de reiniciar a ciegas", () => {
        seedBoard("board-a", "de-a");
        seedBoard("board-b", "de-b");

        const { result, rerender } = renderBoardState("board-a");
        expect(result.current.criteria).toEqual(buildCriteria("de-a"));

        act(() => rerender({ id: "board-b" }));
        expect(result.current.criteria).toEqual(buildCriteria("de-b"));

        act(() => rerender({ id: "board-a" }));
        expect(result.current.criteria).toEqual(buildCriteria("de-a"));
    });

    it("al cambiar a un tablero sin snapshot deja el estado limpio", () => {
        seedBoard("board-a", "de-a");
        const { result, rerender } = renderBoardState("board-a");

        act(() => rerender({ id: "board-c" }));

        expect(result.current.criteria).toEqual({});
        expect(result.current.page).toBe(1);
    });

    it("no persiste la pagina ni el estado del modal", () => {
        const { result } = renderBoardState("board-a");
        const formValues = { subject: { field: "cases.subject", operator: "ilike", type: "AND", value: "x" } };

        act(() => result.current.handleFilter(Object.values(formValues), formValues));
        act(() => result.current.setPage(4));
        act(() => result.current.setOpenFilterModal(true));

        const snapshot = readPersisted(namespaceFor("board-a"), SCOPE);
        expect(snapshot).not.toHaveProperty("page");
        expect(snapshot).not.toHaveProperty("openFilterModal");
    });

    it("vuelve a la pagina 1 al aplicar un filtro", () => {
        const { result } = renderBoardState("board-a");
        act(() => result.current.setPage(3));
        act(() => result.current.handleFilter([], {}));
        expect(result.current.page).toBe(1);
    });

    it("no escribe si el usuario aun no esta resuelto", () => {
        userInformationMock.mockReturnValue({ user: {}, active_group_id: null });
        const { result } = renderBoardState("board-a");

        act(() => result.current.handleFilter([{ field: "a", operator: "eq", type: "AND", value: 1 }], {}));

        expect(readPersisted(namespaceFor("board-a"), { userId: null, groupId: null })).toBeUndefined();
    });

    it("restaura tras el arranque en frio, cuando el usuario aparece despues del primer render", () => {
        seedBoard("board-a", "hola");
        userInformationMock.mockReturnValue({ user: {}, active_group_id: null });

        const { result, rerender } = renderBoardState("board-a");
        expect(result.current.criteria).toEqual({});

        userInformationMock.mockReturnValue({ user: { id: "u1" }, active_group_id: "g1" });
        act(() => rerender({ id: "board-a" }));

        expect(result.current.criteria).toEqual(buildCriteria("hola"));
    });

    it("una accion del usuario en frio gana sobre la relectura tardia", () => {
        seedBoard("board-a", "lo-guardado");
        userInformationMock.mockReturnValue({ user: {}, active_group_id: null });

        const { result, rerender } = renderBoardState("board-a");
        act(() => result.current.clearFilters());

        userInformationMock.mockReturnValue({ user: { id: "u1" }, active_group_id: "g1" });
        act(() => rerender({ id: "board-a" }));

        expect(result.current.criteria).toEqual({});
    });

    it("no comparte estado con el scope de administrador", () => {
        writePersisted(
            buildBoardStateNamespace(BOARD_TABLE_SCOPE.ADMIN, "board-a"),
            { criteria: buildCriteria("de-admin") },
            SCOPE,
        );

        const { result } = renderBoardState("board-a");
        expect(result.current.criteria).toEqual({});
    });
});
