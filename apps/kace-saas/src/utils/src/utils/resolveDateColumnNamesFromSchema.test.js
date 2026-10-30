import { describe, it, expect } from "vitest";
import { resolveDateColumnNamesFromSchema } from "./resolveDateColumnNamesFromSchema";

describe("resolveDateColumnNamesFromSchema", () => {
    it("returns column names with Date data_type from schema-fields API", () => {
        const schema = [
            { column_name: "fecha_asignacion", data_type: "Date" },
            { column_name: "nombres", data_type: "String" },
        ];

        expect(resolveDateColumnNamesFromSchema(schema)).toEqual(["fecha_asignacion"]);
    });

    it("returns column names with lowercase date and datetime types", () => {
        const schema = [
            { column_name: "created_at", data_type: "date" },
            { column_name: "updated_at", data_type: "datetime" },
            { column_name: "reference", data_type: "string" },
        ];

        expect(resolveDateColumnNamesFromSchema(schema)).toEqual(["created_at", "updated_at"]);
    });

    it("uses schema_column_type when present", () => {
        const schema = [
            {
                column_name: "fecha_asignacion",
                data_type: "string",
                schema_column_type: "date",
            },
        ];

        expect(resolveDateColumnNamesFromSchema(schema)).toEqual(["fecha_asignacion"]);
    });

    it("returns empty array for invalid input", () => {
        expect(resolveDateColumnNamesFromSchema(null)).toEqual([]);
        expect(resolveDateColumnNamesFromSchema(undefined)).toEqual([]);
        expect(resolveDateColumnNamesFromSchema([])).toEqual([]);
    });

    it("includes postgres timestamp types", () => {
        const schema = [
            { column_name: "created_at", data_type: "timestamp with time zone" },
            { column_name: "updated_at", schema_column_type: "timestamptz" },
            { column_name: "reference", data_type: "integer" },
        ];

        expect(resolveDateColumnNamesFromSchema(schema)).toEqual(["created_at", "updated_at"]);
    });
});
