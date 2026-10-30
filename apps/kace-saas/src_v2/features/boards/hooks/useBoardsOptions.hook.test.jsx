import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@kace_v2/shared/hooks/useActionsOptions.hook", () => ({
    default: vi.fn(),
}));
vi.mock("@kace_v2/shared/hooks/useRestFlowsOptions.hook", () => ({
    default: vi.fn(),
}));
vi.mock("@kace_v2/features/boards/hooks/useOneScriptOptions.hook", () => ({
    default: vi.fn(),
}));

import useActionsOptions from "@kace_v2/shared/hooks/useActionsOptions.hook";
import useRestFlowsOptions from "@kace_v2/shared/hooks/useRestFlowsOptions.hook";
import useOneScriptOptions from "@kace_v2/features/boards/hooks/useOneScriptOptions.hook";
import useBoardsOptions from "@kace_v2/features/boards/hooks/useBoardsOptions.hook";
import { upsertOptionRow } from "@kace_v2/features/boards/utils/upsertOptionRow.util";

const actionSelector = {
    options: [{ label: "Accion", value: "a1" }],
    onSearch: vi.fn(),
    fetchNextPage: vi.fn(),
};
const restFlowSelector = {
    options: [{ label: "Flujo", value: "r1" }],
    onSearch: vi.fn(),
    fetchNextPage: vi.fn(),
};
const oneScriptSelector = {
    options: [{ label: "OS", value: "o1" }],
    data: [{ label: "OS", value: "o1" }],
    onSearch: vi.fn(),
    fetchNextPage: vi.fn(),
};

describe("useBoardsOptions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useActionsOptions.mockReturnValue(actionSelector);
        useRestFlowsOptions.mockReturnValue(restFlowSelector);
        useOneScriptOptions.mockReturnValue(oneScriptSelector);
    });

    it("compone selectores paginados y pasa los ref_id existentes para asegurar labels", () => {
        const rows = [
            { type: "ACTION", ref_id: "a1" },
            { type: "RESTFLOW", ref_id: "r1" },
            { type: "ONESCRIPT", ref_id: "o1" },
        ];

        const { result } = renderHook(() => useBoardsOptions(rows));

        expect(useActionsOptions).toHaveBeenCalledWith(["a1"]);
        expect(useRestFlowsOptions).toHaveBeenCalledWith(["r1"]);
        expect(useOneScriptOptions).toHaveBeenCalledWith(["o1"]);
        expect(result.current.options.RESTFLOW).toEqual(restFlowSelector.options);
        expect(result.current.selectors.ACTION.onSearch).toBe(actionSelector.onSearch);
        expect(result.current.selectors.ACTION.fetchNextPage).toBe(actionSelector.fetchNextPage);
        expect(result.current.selectors.RESTFLOW.onSearch).toBe(restFlowSelector.onSearch);
        expect(result.current.selectors.ONESCRIPT.onSearch).toBe(oneScriptSelector.onSearch);
        expect(result.current.selectors.ONESCRIPT.fetchNextPage).toBe(oneScriptSelector.fetchNextPage);
    });

    it("vuelve a pedir ensure cuando rows es un array nuevo con un ref_id fuera de la primera pagina", () => {
        const firstRows = [{ type: "ACTION", ref_id: "a1" }];
        const { rerender } = renderHook(({ rows }) => useBoardsOptions(rows), {
            initialProps: { rows: firstRows },
        });

        expect(useActionsOptions).toHaveBeenCalledWith(["a1"]);

        const nextRows = upsertOptionRow(
            firstRows,
            { type: "ACTION", ref_id: "a2-from-search" },
            (item, values) => item.ref_id === values.ref_id,
            () => "row-2",
        );
        rerender({ rows: nextRows });

        expect(firstRows).toEqual([{ type: "ACTION", ref_id: "a1" }]);
        expect(useActionsOptions).toHaveBeenLastCalledWith(["a1", "a2-from-search"]);
    });
});
