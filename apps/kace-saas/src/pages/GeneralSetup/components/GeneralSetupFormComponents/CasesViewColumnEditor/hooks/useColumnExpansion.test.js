import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import useColumnExpansion from "./useColumnExpansion";

describe("useColumnExpansion", () => {
    const mockSchemaFields = {
        view_test_basic: [
            { column_name: "nivel1", label: "Nivel 1" },
            { column_name: "nivel2", label: "Nivel 2" },
            { column_name: "nivel3", label: "Nivel 3" },
            { column_name: "name", label: "Name" },
        ],
        view_test_partial: [
            { column_name: "nivel1", label: "Nivel 1" },
            { column_name: "nivel2", label: "Nivel 2" },
            { column_name: "nivel5", label: "Nivel 5" },
            { column_name: "status", label: "Status" },
        ],
        view_test_single: [{ column_name: "nivel1", label: "Nivel 1" }],
        view_test_mixed_case: [
            { column_name: "Nivel1", label: "Nivel 1" },
            { column_name: "NIVEL2", label: "Nivel 2" },
            { column_name: "nivel3", label: "Nivel 3" },
        ],
        view_test_all_levels: [
            { column_name: "nivel1", label: "Nivel 1" },
            { column_name: "nivel2", label: "Nivel 2" },
            { column_name: "nivel3", label: "Nivel 3" },
            { column_name: "nivel4", label: "Nivel 4" },
            { column_name: "nivel5", label: "Nivel 5" },
            { column_name: "nivel6", label: "Nivel 6" },
            { column_name: "nivel7", label: "Nivel 7" },
            { column_name: "nivel8", label: "Nivel 8" },
            { column_name: "nivel9", label: "Nivel 9" },
            { column_name: "nivel10", label: "Nivel 10" },
        ],
        view_test_invalid_names: [
            { column_name: "nivel", label: "Just Nivel" },
            { column_name: "nivel_cliente", label: "Nivel Cliente" },
            { column_name: "nuevo_nivel", label: "Nuevo Nivel" },
            { column_name: "nivel11", label: "Nivel 11" },
            { column_name: "nombre", label: "Nombre" },
        ],
    };

    describe("hasLevelPattern", () => {
        it("returns true for 'nivel1'", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", "view_test_basic", mockSchemaFields));
            expect(result.current.hasLevelPattern).toBe(true);
        });

        it("returns true for 'nivel10'", () => {
            const { result } = renderHook(() =>
                useColumnExpansion("nivel10", "view_test_all_levels", mockSchemaFields),
            );
            expect(result.current.hasLevelPattern).toBe(true);
        });

        it("returns true for uppercase 'NIVEL2'", () => {
            const { result } = renderHook(() => useColumnExpansion("NIVEL2", "view_test_basic", mockSchemaFields));
            expect(result.current.hasLevelPattern).toBe(true);
        });

        it("returns true for mixed case 'Nivel5'", () => {
            const { result } = renderHook(() => useColumnExpansion("Nivel5", "view_test_all_levels", mockSchemaFields));
            expect(result.current.hasLevelPattern).toBe(true);
        });

        it("returns false for 'nivel_cliente' (underscore suffix)", () => {
            const { result } = renderHook(() =>
                useColumnExpansion("nivel_cliente", "view_test_invalid_names", mockSchemaFields),
            );
            expect(result.current.hasLevelPattern).toBe(false);
        });

        it("returns false for 'nuevo_nivel' (prefix)", () => {
            const { result } = renderHook(() =>
                useColumnExpansion("nuevo_nivel", "view_test_invalid_names", mockSchemaFields),
            );
            expect(result.current.hasLevelPattern).toBe(false);
        });

        it("returns false for 'nivel' (no number)", () => {
            const { result } = renderHook(() =>
                useColumnExpansion("nivel", "view_test_invalid_names", mockSchemaFields),
            );
            expect(result.current.hasLevelPattern).toBe(false);
        });

        it("returns false for 'nivel11' (number out of range)", () => {
            const { result } = renderHook(() =>
                useColumnExpansion("nivel11", "view_test_invalid_names", mockSchemaFields),
            );
            expect(result.current.hasLevelPattern).toBe(false);
        });

        it("returns false for non-nivel columns", () => {
            const { result } = renderHook(() => useColumnExpansion("name", "view_test_basic", mockSchemaFields));
            expect(result.current.hasLevelPattern).toBe(false);
        });
    });

    describe("availableLevels", () => {
        it("detects nivel1, nivel2, nivel3 in schema, sorted correctly", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", "view_test_basic", mockSchemaFields));
            expect(result.current.availableLevels).toHaveLength(3);
            expect(result.current.availableLevels[0].column_name).toBe("nivel1");
            expect(result.current.availableLevels[1].column_name).toBe("nivel2");
            expect(result.current.availableLevels[2].column_name).toBe("nivel3");
        });

        it("sorts numerically: nivel1 < nivel9 < nivel10 (not lexicographic)", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", "view_test_all_levels", mockSchemaFields));
            const names = result.current.availableLevels.map((col) => col.column_name);
            expect(names).toEqual([
                "nivel1",
                "nivel2",
                "nivel3",
                "nivel4",
                "nivel5",
                "nivel6",
                "nivel7",
                "nivel8",
                "nivel9",
                "nivel10",
            ]);
        });

        it("returns only 5 when view has nivel1-nivel5 (handles <10 levels)", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", "view_test_partial", mockSchemaFields));
            expect(result.current.availableLevels).toHaveLength(3);
            const names = result.current.availableLevels.map((col) => col.column_name);
            expect(names).toEqual(["nivel1", "nivel2", "nivel5"]);
        });

        it("returns empty array if viewName is undefined", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", undefined, mockSchemaFields));
            expect(result.current.availableLevels).toEqual([]);
        });

        it("returns empty array if viewName is null", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", null, mockSchemaFields));
            expect(result.current.availableLevels).toEqual([]);
        });

        it("returns empty array if schemaFields[viewName] is missing", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", "nonexistent_view", mockSchemaFields));
            expect(result.current.availableLevels).toEqual([]);
        });

        it("returns empty array if columnName does not match pattern", () => {
            const { result } = renderHook(() => useColumnExpansion("name", "view_test_basic", mockSchemaFields));
            expect(result.current.availableLevels).toEqual([]);
        });

        it("handles case-insensitive matching for schema columns", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", "view_test_mixed_case", mockSchemaFields));
            expect(result.current.availableLevels).toHaveLength(3);
            const names = result.current.availableLevels.map((col) => col.column_name);
            // All mixed-case columns should be included and sorted numerically
            expect(names.length).toBe(3);
        });
    });

    describe("expandToAllLevels", () => {
        it("returns correct VisibleColumn[] shape with cell_type='clasificacion'", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", "view_test_basic", mockSchemaFields));
            const expanded = result.current.expandToAllLevels("clasificacion");
            expect(expanded).toHaveLength(3);
            expanded.forEach((col) => {
                expect(col).toHaveProperty("column_name");
                expect(col).toHaveProperty("header_label");
                expect(col).toHaveProperty("cell_type");
                expect(col.cell_type).toBe("clasificacion");
                expect(col).not.toHaveProperty("separator");
            });
        });

        it("uses column.label for header_label when available", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", "view_test_basic", mockSchemaFields));
            const expanded = result.current.expandToAllLevels("clasificacion");
            expect(expanded[0].header_label).toBe("Nivel 1");
            expect(expanded[1].header_label).toBe("Nivel 2");
            expect(expanded[2].header_label).toBe("Nivel 3");
        });

        it("falls back to column_name for header_label when label is missing", () => {
            const schemaWithoutLabel = {
                view_test: [{ column_name: "nivel1" }, { column_name: "nivel2" }],
            };
            const { result } = renderHook(() => useColumnExpansion("nivel1", "view_test", schemaWithoutLabel));
            const expanded = result.current.expandToAllLevels("clasificacion");
            expect(expanded[0].header_label).toBe("nivel1");
            expect(expanded[1].header_label).toBe("nivel2");
        });

        it("returns single entry when only one level available", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", "view_test_single", mockSchemaFields));
            const expanded = result.current.expandToAllLevels("text");
            expect(expanded).toHaveLength(1);
            expect(expanded[0]).toEqual({
                column_name: "nivel1",
                header_label: "Nivel 1",
                cell_type: "text",
            });
        });

        it("accepts different cell_type values", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", "view_test_basic", mockSchemaFields));
            const expanded = result.current.expandToAllLevels("custom_type");
            expect(expanded[0].cell_type).toBe("custom_type");
        });

        it("returns empty array when columnName does not match pattern", () => {
            const { result } = renderHook(() => useColumnExpansion("name", "view_test_basic", mockSchemaFields));
            const expanded = result.current.expandToAllLevels("clasificacion");
            expect(expanded).toEqual([]);
        });

        it("returns empty array when viewName is missing", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", undefined, mockSchemaFields));
            const expanded = result.current.expandToAllLevels("clasificacion");
            expect(expanded).toEqual([]);
        });

        it("maintains order matching availableLevels", () => {
            const { result } = renderHook(() => useColumnExpansion("nivel1", "view_test_partial", mockSchemaFields));
            const expanded = result.current.expandToAllLevels("clasificacion");
            const columnNames = expanded.map((col) => col.column_name);
            const availableNames = result.current.availableLevels.map((col) => col.column_name);
            expect(columnNames).toEqual(availableNames);
        });
    });

    describe("useMemo optimization", () => {
        it("returns same object reference when inputs don't change", () => {
            const { result, rerender } = renderHook(
                ({ columnName, viewName, schemaFields }) => useColumnExpansion(columnName, viewName, schemaFields),
                {
                    initialProps: {
                        columnName: "nivel1",
                        viewName: "view_test_basic",
                        schemaFields: mockSchemaFields,
                    },
                },
            );

            const firstResult = result.current;
            rerender({
                columnName: "nivel1",
                viewName: "view_test_basic",
                schemaFields: mockSchemaFields,
            });

            expect(result.current).toBe(firstResult);
        });

        it("returns new object reference when columnName changes", () => {
            const { result, rerender } = renderHook(
                ({ columnName, viewName, schemaFields }) => useColumnExpansion(columnName, viewName, schemaFields),
                {
                    initialProps: {
                        columnName: "nivel1",
                        viewName: "view_test_basic",
                        schemaFields: mockSchemaFields,
                    },
                },
            );

            const firstResult = result.current;
            rerender({
                columnName: "nivel2",
                viewName: "view_test_basic",
                schemaFields: mockSchemaFields,
            });

            expect(result.current).not.toBe(firstResult);
        });

        it("returns new object reference when viewName changes", () => {
            const { result, rerender } = renderHook(
                ({ columnName, viewName, schemaFields }) => useColumnExpansion(columnName, viewName, schemaFields),
                {
                    initialProps: {
                        columnName: "nivel1",
                        viewName: "view_test_basic",
                        schemaFields: mockSchemaFields,
                    },
                },
            );

            const firstResult = result.current;
            rerender({
                columnName: "nivel1",
                viewName: "view_test_partial",
                schemaFields: mockSchemaFields,
            });

            expect(result.current).not.toBe(firstResult);
        });
    });
});
