import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userInformationMock = vi.fn(() => ({ user: { id: "u1" }, active_group_id: "g1" }));

vi.mock("@kace/hooks/useUserInformation", () => ({
    default: () => userInformationMock(),
}));

const { readPersisted, writePersisted } = await import("@kace_v2/shared/utils/persistentStorage.util");
const { default: usePersistentState } = await import("./usePersistentState.hook");

const SCOPE = { userId: "u1", groupId: "g1" };

beforeEach(() => {
    vi.useFakeTimers();
    userInformationMock.mockReturnValue({ user: { id: "u1" }, active_group_id: "g1" });
});

afterEach(() => {
    vi.useRealTimers();
});

const flushDebounce = () => act(() => vi.advanceTimersByTime(200));

describe("usePersistentState", () => {
    it("usa el valor por defecto cuando no hay nada persistido", () => {
        const { result } = renderHook(() => usePersistentState("ns", { a: 1 }));
        expect(result.current[0]).toEqual({ a: 1 });
    });

    it("restaura el valor persistido en el primer render", () => {
        writePersisted("ns", { a: 42 }, SCOPE);

        const seen = [];
        renderHook(() => {
            const [value] = usePersistentState("ns", { a: 1 });
            seen.push(value);
            return value;
        });

        expect(seen[0]).toEqual({ a: 42 });
    });

    it("persiste los cambios con debounce", () => {
        const { result } = renderHook(() => usePersistentState("ns", 0));

        act(() => result.current[1](5));
        expect(readPersisted("ns", SCOPE)).toBeUndefined();

        flushDebounce();
        expect(readPersisted("ns", SCOPE)).toBe(5);
    });

    it("soporta la forma con funcion actualizadora", () => {
        const { result } = renderHook(() => usePersistentState("ns", 1));
        act(() => result.current[1]((prev) => prev + 1));
        flushDebounce();
        expect(result.current[0]).toBe(2);
        expect(readPersisted("ns", SCOPE)).toBe(2);
    });

    it("hace flush del valor pendiente al desmontar", () => {
        const { result, unmount } = renderHook(() => usePersistentState("ns", 0));
        act(() => result.current[1](9));
        unmount();
        expect(readPersisted("ns", SCOPE)).toBe(9);
    });

    it("resetValue vuelve al valor por defecto y borra la clave", () => {
        writePersisted("ns", 99, SCOPE);
        const { result } = renderHook(() => usePersistentState("ns", 0));
        expect(result.current[0]).toBe(99);

        act(() => result.current[2]());
        flushDebounce();

        expect(result.current[0]).toBe(0);
        expect(readPersisted("ns", SCOPE)).toBeUndefined();
    });

    it("con enabled:false se comporta como useState", () => {
        writePersisted("ns", 99, SCOPE);
        const { result } = renderHook(() => usePersistentState("ns", 0, { enabled: false }));

        expect(result.current[0]).toBe(0);
        act(() => result.current[1](7));
        flushDebounce();
        expect(readPersisted("ns", SCOPE)).toBe(99);
    });

    it("cae al valor por defecto cuando sanitize rechaza lo persistido", () => {
        writePersisted("ns", "obsoleto", SCOPE);
        const { result } = renderHook(() =>
            usePersistentState("ns", "default", { sanitize: (v) => (v === "valido" ? v : undefined) }),
        );
        expect(result.current[0]).toBe("default");
    });

    it("no escribe mientras el usuario no este resuelto", () => {
        userInformationMock.mockReturnValue({ user: {}, active_group_id: null });
        const { result } = renderHook(() => usePersistentState("ns", 0));

        act(() => result.current[1](3));
        flushDebounce();

        expect(readPersisted("ns", { userId: null, groupId: null })).toBeUndefined();
    });

    it("relee bajo la clave definitiva cuando aparece el usuario", () => {
        writePersisted("ns", 123, SCOPE);
        userInformationMock.mockReturnValue({ user: {}, active_group_id: null });

        const { result, rerender } = renderHook(() => usePersistentState("ns", 0));
        expect(result.current[0]).toBe(0);

        userInformationMock.mockReturnValue({ user: { id: "u1" }, active_group_id: "g1" });
        act(() => rerender());

        expect(result.current[0]).toBe(123);
    });

    it("aisla el estado por usuario", () => {
        writePersisted("ns", "de-u1", SCOPE);
        userInformationMock.mockReturnValue({ user: { id: "u2" }, active_group_id: "g1" });

        const { result } = renderHook(() => usePersistentState("ns", "default"));
        expect(result.current[0]).toBe("default");
    });
});
