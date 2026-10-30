import { describe, expect, it } from "vitest";

import { FILTER_TRANSFORMATIONS } from "../data/constants";
import { processData, processFilters } from "./datatableProcess";

const from = "2025-12-30T00:00:00.000-05:00";
const to = "2025-12-31T23:59:59.999-05:00";

describe("processFilters", () => {
    it.each([
        ["initial_date", "initialDate"],
        ["end_date", "endDate"],
    ])("maps %s to a period date-range filter on %s", (field, path) => {
        const [filter] = processFilters([{ field, operator: "between", value: `${from}, ${to}`, type: "AND" }]);

        expect(filter).toEqual({
            field: "period",
            operator: "jsonPathDateBetween",
            value: JSON.stringify({ path, from, to }),
            type: "AND",
        });
    });

    it.each([
        ["an empty value", ""],
        ["a missing value", undefined],
        ["a single date", from],
        ["a range without end", `${from}, `],
    ])("drops a period filter with %s instead of sending an incomplete range", (_, value) => {
        const createdBy = { field: "created_by", operator: "eq", value: "user-id", type: "AND" };

        expect(processFilters([createdBy, { field: "initial_date", operator: "between", value, type: "AND" }])).toEqual(
            [createdBy],
        );
    });

    it("keeps the rest of the filters untouched", () => {
        const createdBy = { field: "created_by", operator: "eq", value: "user-id", type: "AND" };

        expect(processFilters([createdBy])).toEqual([createdBy]);
    });

    it("turns every column flattened from period into a period filter on the same key", async () => {
        const period = { initialDate: "period:initialDate", endDate: "period:endDate" };
        const [row] = await processData([{ id: "report-id", period }]);
        const periodColumns = Object.entries(row).filter(
            ([column, value]) => column !== "period" && Object.values(period).includes(value),
        );

        expect(periodColumns.length).toBeGreaterThan(0);
        periodColumns.forEach(([column, value]) => {
            const { filterData } = FILTER_TRANSFORMATIONS[column]({ filterData: { value: `${from}, ${to}` } });
            const [filter] = processFilters([filterData]);

            expect(filter.field).toBe("period");
            expect(JSON.parse(filter.value).path).toBe(value.replace("period:", ""));
        });
    });
});
