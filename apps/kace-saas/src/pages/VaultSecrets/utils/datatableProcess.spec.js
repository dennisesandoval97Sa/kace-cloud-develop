import { describe, expect, it } from "vitest";
import { dataTableConfig, FILTER_TRANSFORMATIONS } from "../data/constants";
import { processColumns, processData, processFilters } from "./datatableProcess";

describe("Secrets Vault DataTableV2 processing", () => {
    it("masks every secret after normalizing table rows", async () => {
        const rows = [{ id: "secret-id", secreto: "plain-text-secret" }];

        await expect(processData(rows)).resolves.toEqual([
            {
                id: "secret-id",
                secreto: "***",
            },
        ]);
    });

    it("keeps the five visible columns separate from the six safe filters", () => {
        expect(dataTableConfig.genericColumns).toEqual([
            "descripcion",
            "referencia",
            "secreto",
            "created_at",
            "updated_at",
        ]);
        expect(dataTableConfig.filterColumns).toEqual([
            "descripcion",
            "referencia",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]);

        const defaults = {
            created_at: "shared-created-at-filter",
            updated_at: "shared-updated-at-filter",
        };
        expect(processColumns(defaults)).toEqual({
            ...defaults,
            ...FILTER_TRANSFORMATIONS,
        });
        expect(processFilters([{ column_name: "descripcion", field: "string" }])).toEqual([
            { column_name: "descripcion", field: "string" },
        ]);

        expect(FILTER_TRANSFORMATIONS.descripcion({ column_name: "descripcion" }).filterData).toEqual({
            field: "boveda_secretos.descripcion",
            operator: "ilike",
            type: "AND",
            value: "",
        });
        expect(FILTER_TRANSFORMATIONS.referencia({ column_name: "referencia" }).filterData).toEqual({
            field: "boveda_secretos.referencia",
            operator: "ilike",
            type: "AND",
            value: "",
        });
        expect(FILTER_TRANSFORMATIONS.created_by({ column_name: "created_by" }).filterData).toEqual({
            field: "boveda_secretos.created_by",
            operator: "eq",
            type: "AND",
            value: "",
        });
        expect(FILTER_TRANSFORMATIONS.updated_by({ column_name: "updated_by" }).filterData).toEqual({
            field: "boveda_secretos.updated_by",
            operator: "eq",
            type: "AND",
            value: "",
        });
        expect(FILTER_TRANSFORMATIONS.secreto({ column_name: "secreto" })).toEqual({
            column_name: "secreto",
            enableSorting: false,
        });
    });
});
