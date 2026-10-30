import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useInfiniteScrollGate } from "./useInfiniteScrollGate";

describe("useInfiniteScrollGate", () => {
    it("starts disarmed so consume returns false", () => {
        const { result } = renderHook(() => useInfiniteScrollGate());

        expect(result.current.consume()).toBe(false);
    });

    it("consume returns true once after arm and then disarms", () => {
        const { result } = renderHook(() => useInfiniteScrollGate());

        act(() => {
            result.current.arm();
        });

        expect(result.current.consume()).toBe(true);
        expect(result.current.consume()).toBe(false);
    });

    it("reset disarms an armed gate", () => {
        const { result } = renderHook(() => useInfiniteScrollGate());

        act(() => {
            result.current.arm();
            result.current.reset();
        });

        expect(result.current.consume()).toBe(false);
    });
});
