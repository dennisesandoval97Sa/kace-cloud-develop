import { describe, it, expect } from "vitest";
import { BULK_REQUIRED_COLUMNS, getMissingBulkColumns, isCasesLikeEntity } from "../../utils/casesEntity.util";

describe("casesEntity.util", () => {
    describe("isCasesLikeEntity", () => {
        it("returns true for the real cases table", () => {
            expect(isCasesLikeEntity("cases")).toBe(true);
        });

        it("returns true for board views containing cases or casos", () => {
            expect(isCasesLikeEntity("boards_cases_open")).toBe(true);
            expect(isCasesLikeEntity("boards_casos_abiertos")).toBe(true);
            expect(isCasesLikeEntity("boards_MyCases")).toBe(true);
        });

        it("returns false for non cases-like entities", () => {
            expect(isCasesLikeEntity("clients")).toBe(false);
            expect(isCasesLikeEntity("aux_x")).toBe(false);
            expect(isCasesLikeEntity("boards_clientes")).toBe(false);
            expect(isCasesLikeEntity(null)).toBe(false);
            expect(isCasesLikeEntity(undefined)).toBe(false);
            expect(isCasesLikeEntity("")).toBe(false);
        });
    });

    describe("getMissingBulkColumns", () => {
        it("returns empty when all required columns are present", () => {
            const fields = [
                { column_name: "id" },
                { column_name: "fecha_resolucion" },
                { column_name: "transicion_id" },
                { column_name: "titulo" },
            ];
            expect(getMissingBulkColumns(fields)).toEqual([]);
        });

        it("returns the missing required columns", () => {
            const fields = [{ column_name: "id" }, { column_name: "titulo" }];
            expect(getMissingBulkColumns(fields)).toEqual(["fecha_resolucion", "transicion_id"]);
        });

        it("returns all required columns when schema fields are absent", () => {
            expect(getMissingBulkColumns(null)).toEqual(BULK_REQUIRED_COLUMNS);
            expect(getMissingBulkColumns(undefined)).toEqual(BULK_REQUIRED_COLUMNS);
            expect(getMissingBulkColumns([])).toEqual(BULK_REQUIRED_COLUMNS);
        });
    });
});
