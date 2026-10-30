import { describe, expect, it, vi } from "vitest";
import { createStepJumpHandlers, resolvePageIndex, STEP_JUMP_SIZE } from "./useDataTable";

describe("createStepJumpHandlers", () => {
    it("jumps forward by the step size via goToPage", () => {
        const goToPage = vi.fn();
        const { jumpForward } = createStepJumpHandlers({ goToPage, currentPage: 5 });

        jumpForward();

        expect(goToPage).toHaveBeenCalledWith(5 + STEP_JUMP_SIZE);
    });

    it("jumps backward by the step size via goToPage", () => {
        const goToPage = vi.fn();
        const { jumpBackward } = createStepJumpHandlers({ goToPage, currentPage: 15 });

        jumpBackward();

        expect(goToPage).toHaveBeenCalledWith(15 - STEP_JUMP_SIZE);
    });
});

describe("resolvePageIndex", () => {
    it("returns the zero-based index for an in-range page", () => {
        expect(resolvePageIndex(5, { currentPage: 1, totalPages: 20 })).toBe(4);
    });

    it("clamps a forward jump to the last page", () => {
        // page 18 + 10 = 28 -> clamped to 20 -> index 19
        expect(resolvePageIndex(28, { currentPage: 18, totalPages: 20 })).toBe(19);
    });

    it("clamps a backward jump to the first page", () => {
        // page 4 - 10 = -6 -> clamped to 1 -> index 0
        expect(resolvePageIndex(-6, { currentPage: 4, totalPages: 20 })).toBe(0);
    });

    it("falls back to the current page for non-finite input", () => {
        expect(resolvePageIndex("not-a-number", { currentPage: 7, totalPages: 20 })).toBe(6);
    });
});
