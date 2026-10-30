import { describe, it, expect } from "vitest";
import { normalizeBoardsData } from "@kace_v2/features/boards/utils/normalizeBoardsData.util";
import { BOARDS_DETAILS } from "@kace_v2/features/boards/constants/boards.constants";

describe("normalizeBoardsData — quick_ans_filter", () => {
    it("returns INITIAL_VALUES when data is null", () => {
        expect(normalizeBoardsData(null)).toBe(BOARDS_DETAILS.INITIAL_VALUES);
    });

    it("provides the default quick_ans_filter shape when the field is absent", () => {
        const result = normalizeBoardsData({});
        expect(result.quick_ans_filter).toEqual({
            enabled: false,
            ans_column_alias: "",
            labels: { 1: "", 2: "", 3: "" },
            use_default_colors: true,
            colors: { 1: "", 2: "", 3: "" },
        });
    });

    it("fills missing labels/colors keys when partially provided", () => {
        const result = normalizeBoardsData({
            quick_ans_filter: {
                enabled: true,
                ans_column_alias: "alias",
                labels: { 1: "Solo 1" },
                colors: { 2: "#abcdef" },
            },
        });
        expect(result.quick_ans_filter).toEqual({
            enabled: true,
            ans_column_alias: "alias",
            labels: { 1: "Solo 1", 2: "", 3: "" },
            use_default_colors: true,
            colors: { 1: "", 2: "#abcdef", 3: "" },
        });
    });

    it("preserves use_default_colors=false when explicitly set", () => {
        const result = normalizeBoardsData({
            quick_ans_filter: { use_default_colors: false },
        });
        expect(result.quick_ans_filter.use_default_colors).toBe(false);
    });

    it("defaults use_default_colors to true when the flag is missing", () => {
        const result = normalizeBoardsData({ quick_ans_filter: {} });
        expect(result.quick_ans_filter.use_default_colors).toBe(true);
    });

    it("coerces enabled to a boolean", () => {
        expect(normalizeBoardsData({ quick_ans_filter: { enabled: "yes" } }).quick_ans_filter.enabled).toBe(true);
        expect(normalizeBoardsData({ quick_ans_filter: { enabled: 0 } }).quick_ans_filter.enabled).toBe(false);
    });
});

describe("normalizeBoardsData — numeric fields", () => {
    it.each([
        [null, ""],
        [undefined, ""],
        ["", ""],
        ["abc", ""],
        ["7", 7],
        [7, 7],
    ])("normalizes display_order %p to %p", (input, expected) => {
        expect(normalizeBoardsData({ display_order: input }).display_order).toBe(expected);
    });

    it.each([
        [null, ""],
        [undefined, ""],
        ["", ""],
        ["abc", ""],
        ["50", 50],
        [50, 50],
    ])("normalizes page_size %p to %p", (input, expected) => {
        expect(normalizeBoardsData({ page_size: input }).page_size).toBe(expected);
    });

    it("leaves display_order empty when the board has no order assigned", () => {
        expect(normalizeBoardsData({ name: "Tablero" }).display_order).toBe("");
    });
});
