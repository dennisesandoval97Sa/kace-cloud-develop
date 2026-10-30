import { describe, it, expect, vi } from "vitest";
import {
    bindBoardOptionSelector,
    boardOptionSelectorByType,
} from "@kace_v2/features/boards/utils/bindBoardOptionSelector.util";

describe("bindBoardOptionSelector", () => {
    it("expone busqueda remota y scroll infinito del selector", () => {
        const onSearch = vi.fn();
        const fetchNextPage = vi.fn();

        expect(
            bindBoardOptionSelector({
                options: [{ label: "Flujo A", value: "rf-1" }],
                onSearch,
                fetchNextPage,
                hasNextPage: true,
                isFetchingNextPage: false,
                isLoading: false,
            }),
        ).toEqual({
            options: [{ label: "Flujo A", value: "rf-1" }],
            onSearch,
            fetchNextPage,
            hasNextPage: true,
            isFetchingNextPage: false,
            isLoading: false,
        });
    });

    it("si no hay selector deja options vacias y callbacks indefinidos", () => {
        expect(bindBoardOptionSelector(undefined)).toEqual({
            options: [],
            onSearch: undefined,
            fetchNextPage: undefined,
            hasNextPage: undefined,
            isFetchingNextPage: undefined,
            isLoading: undefined,
        });
    });
});

describe("boardOptionSelectorByType", () => {
    const selectors = {
        ACTION: { onSearch: vi.fn(), fetchNextPage: vi.fn() },
        RESTFLOW: { onSearch: vi.fn(), fetchNextPage: vi.fn() },
        ONESCRIPT: { onSearch: vi.fn(), fetchNextPage: vi.fn() },
    };

    it.each(["ACTION", "RESTFLOW", "ONESCRIPT"])("resuelve el selector de %s", (type) => {
        expect(boardOptionSelectorByType(selectors, type)).toBe(selectors[type]);
        expect(typeof boardOptionSelectorByType(selectors, type).onSearch).toBe("function");
        expect(typeof boardOptionSelectorByType(selectors, type).fetchNextPage).toBe("function");
    });
});
