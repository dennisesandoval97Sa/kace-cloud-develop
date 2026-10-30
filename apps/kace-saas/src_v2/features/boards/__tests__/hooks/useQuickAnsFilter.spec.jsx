import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@kace_v2/features/boards/hooks/useAns.hook", () => ({
    default: () => ({
        data: [
            {
                id: "ans-1",
                color_ans_inicial: "#100000",
                color_ans_intermedio: "#200000",
                color_ans_final: "#300000",
            },
        ],
    }),
}));

import useQuickAnsFilter from "@kace_v2/features/boards/hooks/useQuickAnsFilter.hook";

const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const buildBoardConfig = (overrides = {}) => ({
    id: "board-1",
    columns: [{ is_ans: true, alias: "ans_alias", field: "ans_field" }],
    quick_ans_filter: {
        enabled: true,
        ans_column_alias: "ans_alias",
        labels: { 1: "", 2: "", 3: "" },
        use_default_colors: true,
        colors: { 1: "", 2: "", 3: "" },
    },
    ...overrides,
});

describe("useQuickAnsFilter", () => {
    let handleFilter;
    let clearFilters;

    beforeEach(() => {
        handleFilter = vi.fn();
        clearFilters = vi.fn();
    });

    it("returns null quickAnsFilter when the feature is disabled", () => {
        const { result } = renderHook(
            () =>
                useQuickAnsFilter({
                    boardConfig: buildBoardConfig({
                        quick_ans_filter: { enabled: false },
                    }),
                    criteria: {},
                    handleFilter,
                    clearFilters,
                }),
            { wrapper: createWrapper() },
        );
        expect(result.current.quickAnsFilter).toBeNull();
    });

    it("builds three buttons with translated default labels and ANS colors", () => {
        const { result } = renderHook(
            () =>
                useQuickAnsFilter({
                    boardConfig: buildBoardConfig(),
                    criteria: {},
                    handleFilter,
                    clearFilters,
                }),
            { wrapper: createWrapper() },
        );
        const buttons = result.current.quickAnsFilter?.buttons ?? [];
        expect(buttons).toHaveLength(3);
        expect(buttons.map((b) => b.value)).toEqual([1, 2, 3]);
        expect(buttons[0].color).toBe("#100000");
        expect(buttons[1].color).toBe("#200000");
        expect(buttons[2].color).toBe("#300000");
        buttons.forEach((b) => expect(typeof b.label).toBe("string"));
        expect(buttons[0].label.length).toBeGreaterThan(0);
    });

    it("normalizes activeAnsValue to a number even if criteria stores it as a string", () => {
        const { result } = renderHook(
            () =>
                useQuickAnsFilter({
                    boardConfig: buildBoardConfig(),
                    criteria: { filter: [{ field: "ans_alias", operator: "eq", value: "2" }] },
                    handleFilter,
                    clearFilters,
                }),
            { wrapper: createWrapper() },
        );
        expect(result.current.activeAnsValue).toBe(2);
    });

    it("clears the filter when applying the value that is already active (toggle)", () => {
        const { result } = renderHook(
            () =>
                useQuickAnsFilter({
                    boardConfig: buildBoardConfig(),
                    criteria: { filter: [{ field: "ans_alias", operator: "eq", value: "2" }] },
                    handleFilter,
                    clearFilters,
                }),
            { wrapper: createWrapper() },
        );

        act(() => {
            result.current.applyQuickAnsFilter(2);
        });
        expect(clearFilters).toHaveBeenCalledTimes(1);
        expect(handleFilter).not.toHaveBeenCalled();
    });

    it("sends a numeric value through handleFilter when applying a new value", () => {
        const { result } = renderHook(
            () =>
                useQuickAnsFilter({
                    boardConfig: buildBoardConfig({
                        columns: [{ is_ans: true, alias: "ans_alias", field: "ans_field", entity: "cases" }],
                    }),
                    criteria: {},
                    handleFilter,
                    clearFilters,
                }),
            { wrapper: createWrapper() },
        );

        act(() => {
            result.current.applyQuickAnsFilter(3);
        });

        expect(handleFilter).toHaveBeenCalledWith([
            {
                field: "ans_alias",
                operator: "eq",
                type: "AND",
                value: 3,
                entity: "cases",
            },
        ]);
    });

    it("preserves non-ANS filters when toggling the active ANS value off", () => {
        const criteria = {
            filter: [
                { field: "ans_alias", operator: "eq", value: 2 },
                { field: "status", operator: "eq", value: "open" },
            ],
        };

        const { result } = renderHook(
            () => useQuickAnsFilter({ boardConfig: buildBoardConfig(), criteria, handleFilter, clearFilters }),
            { wrapper: createWrapper() },
        );

        act(() => {
            result.current.applyQuickAnsFilter(2);
        });

        expect(clearFilters).not.toHaveBeenCalled();
        expect(handleFilter).toHaveBeenCalledWith([{ field: "status", operator: "eq", value: "open" }]);
    });

    it("preserves non-ANS filters when switching the active ANS value", () => {
        const criteria = {
            filter: [
                { field: "ans_alias", operator: "eq", value: 1 },
                { field: "owner", operator: "eq", value: "u1" },
            ],
        };

        const { result } = renderHook(
            () =>
                useQuickAnsFilter({
                    boardConfig: buildBoardConfig({
                        columns: [{ is_ans: true, alias: "ans_alias", field: "ans_field", entity: "cases" }],
                    }),
                    criteria,
                    handleFilter,
                    clearFilters,
                }),
            { wrapper: createWrapper() },
        );

        act(() => {
            result.current.applyQuickAnsFilter(3);
        });

        expect(clearFilters).not.toHaveBeenCalled();
        expect(handleFilter).toHaveBeenCalledWith([
            { field: "owner", operator: "eq", value: "u1" },
            { field: "ans_alias", operator: "eq", type: "AND", value: 3, entity: "cases" },
        ]);
    });

    it("handleModalFilter prepends the active ANS filter to the modal submitted filters", () => {
        const criteria = {
            filter: [{ field: "ans_alias", operator: "eq", value: 2 }],
        };

        const { result } = renderHook(
            () => useQuickAnsFilter({ boardConfig: buildBoardConfig(), criteria, handleFilter, clearFilters }),
            { wrapper: createWrapper() },
        );

        const modalFilters = [{ field: "status", operator: "eq", value: "open" }];

        act(() => {
            result.current.handleModalFilter(modalFilters);
        });

        expect(handleFilter).toHaveBeenCalledWith(
            [
                { field: "ans_alias", operator: "eq", value: 2 },
                { field: "status", operator: "eq", value: "open" },
            ],
            undefined,
        );
    });

    it("handleModalFilter forwards filters untouched when no ANS filter is active", () => {
        const { result } = renderHook(
            () => useQuickAnsFilter({ boardConfig: buildBoardConfig(), criteria: {}, handleFilter, clearFilters }),
            { wrapper: createWrapper() },
        );

        const modalFilters = [{ field: "status", operator: "eq", value: "open" }];

        act(() => {
            result.current.handleModalFilter(modalFilters);
        });

        expect(handleFilter).toHaveBeenCalledWith(modalFilters, undefined);
    });
});
