import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useDebounced from "./useDebounced";

describe("useDebounced", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("invoca el callback una sola vez con los últimos argumentos tras el retardo", () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useDebounced(callback, 300));

        result.current("a");
        result.current("ab");
        vi.advanceTimersByTime(299);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith("ab");
    });

    it("cancel descarta la invocación pendiente", () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useDebounced(callback, 300));

        result.current("a");
        result.current.cancel();
        vi.advanceTimersByTime(300);

        expect(callback).not.toHaveBeenCalled();
    });

    it("cancel sin invocación pendiente no falla y no bloquea las siguientes", () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useDebounced(callback, 300));

        result.current.cancel();
        result.current("a");
        vi.advanceTimersByTime(300);

        expect(callback).toHaveBeenCalledWith("a");
    });

    it("descarta la invocación pendiente al desmontar", () => {
        const callback = vi.fn();
        const { result, unmount } = renderHook(() => useDebounced(callback, 300));

        result.current("a");
        unmount();
        vi.advanceTimersByTime(300);

        expect(callback).not.toHaveBeenCalled();
    });

    it("conserva la misma referencia entre renders mientras el retardo no cambie", () => {
        const { result, rerender } = renderHook(({ callback }) => useDebounced(callback, 300), {
            initialProps: { callback: vi.fn() },
        });
        const firstDebounced = result.current;

        rerender({ callback: vi.fn() });

        expect(result.current).toBe(firstDebounced);
        expect(result.current.cancel).toBe(firstDebounced.cancel);
    });

    it("cambia la referencia cuando cambia el retardo", () => {
        const { result, rerender } = renderHook(({ delay }) => useDebounced(vi.fn(), delay), {
            initialProps: { delay: 300 },
        });
        const firstDebounced = result.current;

        rerender({ delay: 500 });

        expect(result.current).not.toBe(firstDebounced);
    });

    it("una invocación pendiente ejecuta el callback del último render", () => {
        const staleCallback = vi.fn();
        const latestCallback = vi.fn();
        const { result, rerender } = renderHook(({ callback }) => useDebounced(callback, 300), {
            initialProps: { callback: staleCallback },
        });

        result.current("a");
        rerender({ callback: latestCallback });
        vi.advanceTimersByTime(300);

        expect(staleCallback).not.toHaveBeenCalled();
        expect(latestCallback).toHaveBeenCalledWith("a");
    });
    it("flush ejecuta ya la invocación pendiente con los últimos argumentos y una sola vez", () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useDebounced(callback, 300));

        result.current("a");
        result.current("ab");
        result.current.flush();

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith("ab");

        vi.advanceTimersByTime(300);
        result.current.flush();
        expect(callback).toHaveBeenCalledOnce();
    });

    it("flush sin invocación pendiente no llama al callback", () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useDebounced(callback, 300));

        result.current.flush();
        result.current("a");
        vi.advanceTimersByTime(300);
        result.current.flush();

        expect(callback).toHaveBeenCalledOnce();
    });

    it("flush después de cancel no llama al callback", () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useDebounced(callback, 300));

        result.current("a");
        result.current.cancel();
        result.current.flush();

        expect(callback).not.toHaveBeenCalled();
    });

    it("con flushOnUnmount ejecuta la invocación pendiente al desmontar", () => {
        const callback = vi.fn();
        const { result, unmount } = renderHook(() => useDebounced(callback, 300, { flushOnUnmount: true }));

        result.current("a");
        unmount();

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith("a");

        vi.advanceTimersByTime(300);
        expect(callback).toHaveBeenCalledOnce();
    });

    it("con flushOnUnmount no llama al callback al desmontar si no hay invocación pendiente", () => {
        const callback = vi.fn();
        const { unmount } = renderHook(() => useDebounced(callback, 300, { flushOnUnmount: true }));

        unmount();

        expect(callback).not.toHaveBeenCalled();
    });
});
