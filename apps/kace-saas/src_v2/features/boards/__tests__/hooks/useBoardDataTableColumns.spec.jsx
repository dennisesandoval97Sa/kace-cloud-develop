import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBoardDataTableColumns } from "@kace_v2/features/boards/hooks/useBoardDataTableColumns.hook";

describe("useBoardDataTableColumns", () => {
    it("sets sortable true when column has group_by", () => {
        const { result } = renderHook(() =>
            useBoardDataTableColumns(
                {
                    columns: [
                        {
                            visible: true,
                            field: "dim",
                            alias: "dim_alias",
                            group_by: true,
                            function: null,
                        },
                    ],
                },
                false,
            ),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].sortable).toBe(true);
    });

    it("sets sortable true when group_by is false including lowercase aggregate function names", () => {
        const { result } = renderHook(() =>
            useBoardDataTableColumns(
                {
                    columns: [
                        {
                            visible: true,
                            field: "id",
                            alias: "total",
                            group_by: false,
                            function: "count",
                        },
                    ],
                },
                false,
            ),
        );
        expect(result.current[0].sortable).toBe(true);
    });

    it("sets sortable true for date_difference comparison columns when not group_by", () => {
        const { result } = renderHook(() =>
            useBoardDataTableColumns(
                {
                    columns: [
                        {
                            visible: true,
                            field: "created_at",
                            alias: "diff_segundos",
                            group_by: false,
                            function: "date_difference",
                        },
                    ],
                },
                false,
            ),
        );
        expect(result.current[0].sortable).toBe(true);
    });
});
