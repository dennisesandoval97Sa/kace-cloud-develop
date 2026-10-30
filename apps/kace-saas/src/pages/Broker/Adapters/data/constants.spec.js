import { describe, expect, it } from "vitest";
import { FILTER_TRANSFORMATIONS } from "./constants";

describe("Adapters FILTER_TRANSFORMATIONS", () => {
    it("filters name with ilike against the broker_adapters table the backend authorizes", () => {
        expect(FILTER_TRANSFORMATIONS.name({ column_name: "name" }).filterData).toEqual({
            field: "broker_adapters.name",
            operator: "ilike",
            type: "AND",
            value: "",
        });
    });
});
