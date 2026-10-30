import { describe, it, expect } from "vitest";
import {
    getClassificationChildren,
    getClassificationDisplay,
    getClassificationColumn,
    isClassificationCellType,
    getExpandableClassificationColumn,
    getExpandableClassificationLevelsFromRow,
    getMaxAvailableNivelLevel,
    getRowExpandableClassificationLevels,
    getSeparatorClassificationDisplay,
    isNivelColumn,
    isSeparatorClassificationColumn,
    parseNivelNumber,
    parseSeparatorClassificationValue,
    shouldExpandClassificationLevels,
    wouldBeExpandableClassificationColumn,
} from "./classificationLevels.util";
import { normalizeVisibleColumns } from "./processCasesData";
import {
    transformNivelFilters,
    transformNivelField,
    createNivelFieldTransformer,
    resolveCasesFilterCriterion,
    createCasesFilterCriterionResolver,
} from "./transformNivelFilters";

describe("classificationLevels.util", () => {
    it("detects nivel columns from nivel1 to nivel10", () => {
        expect(isNivelColumn("nivel1")).toBe(true);
        expect(isNivelColumn("nivel5")).toBe(true);
        expect(isNivelColumn("nivel10")).toBe(true);
        expect(isNivelColumn("nivel01")).toBe(false);
        expect(isNivelColumn("nivel11")).toBe(false);
    });

    it("parses the level number out of a nivelX column name", () => {
        expect(parseNivelNumber("nivel3")).toBe(3);
        expect(parseNivelNumber("nivel10")).toBe(10);
        expect(parseNivelNumber("nivel11")).toBeNull();
        expect(parseNivelNumber("reference")).toBeNull();
    });

    it("builds display from all filled levels regardless of configured root", () => {
        const row = {
            nivel1: "Asistencia",
            nivel2: "Tareas de monitoreo",
        };

        expect(getClassificationDisplay(row, "nivel1")).toEqual({
            label: "Asistencia",
            count: 2,
            hasExpandableChildren: true,
        });

        expect(getClassificationDisplay(row, "nivel5")).toEqual({
            label: "Asistencia",
            count: 2,
            hasExpandableChildren: true,
        });

        expect(getExpandableClassificationLevelsFromRow(row, "nivel5").map((level) => level.id)).toEqual(["nivel2"]);
    });

    it("uses levels deeper than the configured root when they exist", () => {
        const row = {
            nivel1: "Asistencia",
            nivel5: "Nivel cinco",
            nivel6: "Nivel seis",
        };

        expect(getClassificationDisplay(row, "nivel5")).toEqual({
            label: "Asistencia",
            count: 3,
            hasExpandableChildren: true,
        });

        expect(getExpandableClassificationLevelsFromRow(row, "nivel5").map((level) => level.id)).toEqual(["nivel6"]);
    });

    it("filters children deeper than the selected root level", () => {
        const children = [
            { id: "nivel2", label: "L2" },
            { id: "nivel5", label: "L5" },
            { id: "nivel6", label: "L6" },
        ];

        expect(getClassificationChildren(children, "nivel5").map((c) => c.id)).toEqual(["nivel6"]);
        expect(getClassificationChildren(children, "nivel1").map((c) => c.id)).toEqual(["nivel2", "nivel5", "nivel6"]);
    });

    it("defaults expand_levels to true for nivel clasificacion columns", () => {
        expect(
            shouldExpandClassificationLevels({
                column_name: "nivel5",
                cell_type: "clasificacion",
            }),
        ).toBe(true);
    });

    it("finds the expandable classification column in a column list", () => {
        const columns = [
            { column_name: "reference", cell_type: "default" },
            { column_name: "nivel5", cell_type: "clasificacion", expand_levels: true },
            { column_name: "nivel6", cell_type: "clasificacion", expand_levels: false },
        ];

        expect(getExpandableClassificationColumn(columns)?.column_name).toBe("nivel5");
    });

    it("finds the single classification column regardless of expand_levels or separator", () => {
        const columns = [
            { column_name: "reference", cell_type: "default" },
            { column_name: "nivel5", cell_type: "clasificacion", expand_levels: false },
        ];

        expect(getClassificationColumn(columns)?.column_name).toBe("nivel5");

        expect(
            getClassificationColumn([
                { column_name: "clasificacion_path", cell_type: "clasificacion", separator: "->" },
            ])?.column_name,
        ).toBe("clasificacion_path");

        expect(getClassificationColumn([{ column_name: "reference", cell_type: "default" }])).toBeNull();

        expect(getClassificationColumn([])).toBeNull();
    });

    it("detects classification cell types the same way getClassificationColumn does", () => {
        expect(isClassificationCellType("clasificacion")).toBe(true);
        expect(isClassificationCellType("estado")).toBe(false);
        expect(isClassificationCellType(undefined)).toBe(false);
    });

    it("parses separator-based classification values into levels", () => {
        const levels = parseSeparatorClassificationValue("Nivel 1 -> Nivel 2 -> Nivel 3", "->");

        expect(levels.map((level) => level.label)).toEqual(["Nivel 1", "Nivel 2", "Nivel 3"]);
        expect(levels.map((level) => level.id)).toEqual(["level-1", "level-2", "level-3"]);
    });

    it("shows non-string classification values without splitting", () => {
        expect(parseSeparatorClassificationValue(120, "f")).toEqual([
            { id: "level-1", label: "120", value: "120", level: 1 },
        ]);

        expect(parseSeparatorClassificationValue("12f34", "f").map((level) => level.label)).toEqual(["12", "34"]);

        expect(getSeparatorClassificationDisplay({ antiguedad_minutos: 45 }, "antiguedad_minutos", "f")).toEqual({
            label: "45",
            count: 1,
            hasExpandableChildren: false,
        });
    });

    it("builds separator classification display with expandable grouped levels", () => {
        const row = {
            clasificacion_path: "Asistencia -> Tareas de monitoreo",
        };

        expect(getSeparatorClassificationDisplay(row, "clasificacion_path", "->")).toEqual({
            label: "Asistencia",
            count: 2,
            hasExpandableChildren: true,
        });

        expect(
            getRowExpandableClassificationLevels(row, {
                column_name: "clasificacion_path",
                cell_type: "clasificacion",
                separator: "->",
            }).map((level) => level.label),
        ).toEqual(["Tareas de monitoreo"]);
    });

    it("detects expandable separator classification columns", () => {
        expect(
            isSeparatorClassificationColumn({
                column_name: "clasificacion_path",
                cell_type: "clasificacion",
                separator: "->",
            }),
        ).toBe(true);

        expect(
            wouldBeExpandableClassificationColumn({
                column_name: "clasificacion_path",
                cell_type: "clasificacion",
                separator: "->",
                expand_levels: true,
            }),
        ).toBe(true);

        expect(
            wouldBeExpandableClassificationColumn({
                column_name: "clasificacion_path",
                cell_type: "clasificacion",
                separator: "->",
                expand_levels: false,
            }),
        ).toBe(false);
    });

    it("respects expand_levels false for single-column rendering", () => {
        expect(
            shouldExpandClassificationLevels({
                column_name: "nivel5",
                cell_type: "clasificacion",
                expand_levels: false,
            }),
        ).toBe(false);
    });

    it("uses the most superficial filled level as the display label (root, not leaf)", () => {
        const row = { nivel1: "Raíz", nivel2: "Medio", nivel3: "Hoja" };
        expect(getClassificationDisplay(row, "nivel1").label).toBe("Raíz");
    });

    it("shows nivel 1 for classification groupings (QA 20/06: Monitoreo retiro en sitio)", () => {
        const row = {
            nivel1: "Monitoreo retiro en sitio",
            nivel2: "Tareas de monitoreo",
            nivel3: "Retiro",
        };

        expect(getClassificationDisplay(row, "nivel1").label).toBe("Monitoreo retiro en sitio");
        expect(
            getSeparatorClassificationDisplay(
                { clasificacion_path: "Monitoreo retiro en sitio > Tareas > Retiro" },
                "clasificacion_path",
                " > ",
            ).label,
        ).toBe("Monitoreo retiro en sitio");
    });

    it("uses nivel2 as label when nivel1 is absent (most superficial available)", () => {
        // Caso borde: vista personalizada que no expone nivel1
        const row = { nivel2: "Soporte", nivel3: "Técnico" };
        const result = getClassificationDisplay(row, "nivel2");
        expect(result.label).toBe("Soporte");
        expect(result.count).toBe(2);
        expect(result.hasExpandableChildren).toBe(true);
    });

    it("returns empty display when no niveles are filled", () => {
        expect(getClassificationDisplay({}, "nivel1")).toEqual({
            label: "",
            count: 0,
            hasExpandableChildren: false,
        });
    });

    it("count reflects total filled levels; hasExpandableChildren reflects levels deeper than root", () => {
        const row = { nivel1: "Asistencia", nivel5: "Nivel cinco", nivel6: "Nivel seis" };
        const result = getClassificationDisplay(row, "nivel5");
        expect(result.count).toBe(3); // total filled, no solo hijos del root
        expect(result.hasExpandableChildren).toBe(true);
        expect(getExpandableClassificationLevelsFromRow(row, "nivel5").map((l) => l.id)).toEqual(["nivel6"]);
    });
});

describe("normalizeVisibleColumns with expandable nivel roots", () => {
    it("keeps only the expandable root nivel column", () => {
        const columns = [
            { column_name: "nivel5", header_label: "Nivel 5", cell_type: "clasificacion", expand_levels: true },
            { column_name: "nivel6", header_label: "Nivel 6", cell_type: "clasificacion" },
            { column_name: "reference", header_label: "Ref", cell_type: "default" },
        ];

        expect(normalizeVisibleColumns(columns).map((c) => c.column_name)).toEqual(["nivel5", "reference"]);
    });
});

describe("transformNivelFilters", () => {
    it("prefixes nivel fields with 'clasificaciones.' in classic view", () => {
        const filters = [{ field: "nivel3", operator: "ilike", value: "Soporte", type: "AND" }];
        const result = transformNivelFilters(filters, { isCustomView: false });
        expect(result[0].field).toBe("clasificaciones.nivel3");
    });

    it("leaves nivel fields as-is in custom view", () => {
        const filters = [{ field: "nivel3", operator: "ilike", value: "Soporte", type: "AND" }];
        const result = transformNivelFilters(filters, { isCustomView: true });
        expect(result[0].field).toBe("nivel3");
    });

    it("does not transform non-nivel fields in any view", () => {
        const filters = [
            { field: "status", operator: "eq", value: "1", type: "AND" },
            { field: "reference", operator: "ilike", value: "INC-001", type: "AND" },
        ];
        expect(transformNivelFilters(filters, { isCustomView: false })).toEqual(filters);
        expect(transformNivelFilters(filters, { isCustomView: true })).toEqual(filters);
    });

    it("does not transform nivel0 or nivel11 (outside supported range)", () => {
        const outOfRange = [
            { field: "nivel0", operator: "ilike", value: "X", type: "AND" },
            { field: "nivel11", operator: "ilike", value: "Y", type: "AND" },
        ];
        expect(transformNivelFilters(outOfRange, { isCustomView: false })).toEqual(outOfRange);
    });

    it("preserves all other filter properties when transforming field", () => {
        const filter = { field: "nivel1", operator: "ilike", value: "Asistencia", type: "AND" };
        const [result] = transformNivelFilters([filter], { isCustomView: false });
        expect(result).toEqual({
            field: "clasificaciones.nivel1",
            operator: "ilike",
            value: "Asistencia",
            type: "AND",
        });
    });
});

describe("transformNivelField", () => {
    it("prefixes nivel field in classic view", () => {
        expect(transformNivelField("nivel3", { isCustomView: false })).toBe("clasificaciones.nivel3");
    });

    it("returns nivel field as-is in custom view", () => {
        expect(transformNivelField("nivel3", { isCustomView: true })).toBe("nivel3");
    });

    it("does not transform non-nivel fields", () => {
        expect(transformNivelField("status", { isCustomView: false })).toBe("status");
        expect(transformNivelField("reference", { isCustomView: true })).toBe("reference");
    });

    it("does not transform out-of-range nivel fields", () => {
        expect(transformNivelField("nivel0", { isCustomView: false })).toBe("nivel0");
        expect(transformNivelField("nivel11", { isCustomView: false })).toBe("nivel11");
    });
});

describe("createNivelFieldTransformer", () => {
    it("returns a callback that transforms nivel fields in classic view", () => {
        const transform = createNivelFieldTransformer({ isCustomView: false });
        expect(transform("nivel1")).toBe("clasificaciones.nivel1");
        expect(transform("nivel10")).toBe("clasificaciones.nivel10");
        expect(transform("status")).toBe("status");
    });

    it("returns a callback that leaves nivel fields as-is in custom view", () => {
        const transform = createNivelFieldTransformer({ isCustomView: true });
        expect(transform("nivel1")).toBe("nivel1");
        expect(transform("nivel5")).toBe("nivel5");
    });

    it("produces same results as transformNivelFilters for consistency", () => {
        const filters = [
            { field: "nivel3", operator: "ilike", value: "Soporte", type: "AND" },
            { field: "status", operator: "eq", value: "1", type: "AND" },
        ];

        const transform = createNivelFieldTransformer({ isCustomView: false });
        const batchResult = transformNivelFilters(filters, { isCustomView: false });

        /*
         * The single-field transformer should produce the same field values
         * as the batch transformer
         */
        filters.forEach((filter, i) => {
            expect(transform(filter.field)).toBe(batchResult[i].field);
        });
    });
});

describe("resolveCasesFilterCriterion", () => {
    it("maps fecha_vencimiento to cases.sla_due_date on the classic path", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "fecha_vencimiento",
                value: "2026-01-01T00:00:00.000Z, 2026-01-02T00:00:00.000Z",
                isCustomView: false,
            }),
        ).toEqual({
            field: "cases.sla_due_date",
            value: "2026-01-01T00:00:00.000Z, 2026-01-02T00:00:00.000Z",
        });
    });

    it("keeps flat view column names when isCustomView is true", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "fecha_vencimiento",
                value: "2026-01-01T00:00:00.000Z, 2026-01-02T00:00:00.000Z",
                isCustomView: true,
            }),
        ).toEqual({
            field: "fecha_vencimiento",
            value: "2026-01-01T00:00:00.000Z, 2026-01-02T00:00:00.000Z",
        });
        expect(
            resolveCasesFilterCriterion({
                field: "estadoActual",
                value: "ESCALADO",
                isCustomView: true,
            }),
        ).toEqual({ field: "estadoActual", value: "ESCALADO" });
        expect(
            resolveCasesFilterCriterion({
                field: "estado_id",
                value: "state-uuid",
                isCustomView: true,
            }),
        ).toEqual({ field: "estado_id", value: "state-uuid", operator: "eq" });
        expect(
            resolveCasesFilterCriterion({
                field: "grupo_nombre",
                value: "BO",
                isCustomView: true,
            }),
        ).toEqual({ field: "grupo_nombre", value: "BO" });
        expect(
            resolveCasesFilterCriterion({
                field: "responsable_nombre",
                value: "Ana",
                isCustomView: true,
            }),
        ).toEqual({ field: "responsable_nombre", value: "Ana" });
    });

    it("resolves nivel3/Foo to clasificaciones.nivel3 in classic view", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "nivel1",
                value: "nivel3/Foo",
                isCustomView: false,
            }),
        ).toEqual({ field: "clasificaciones.nivel3", value: "Foo" });
    });

    it("resolves clasificaciones.nivel3/Foo to clasificaciones.nivel3 in classic view", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "nivel1",
                value: "clasificaciones.nivel3/Foo",
                isCustomView: false,
            }),
        ).toEqual({ field: "clasificaciones.nivel3", value: "Foo" });
    });

    it("resolves nivel1/Bar to clasificaciones.nivel1 in classic view", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "nivel1",
                value: "nivel1/Bar",
                isCustomView: false,
            }),
        ).toEqual({ field: "clasificaciones.nivel1", value: "Bar" });
    });

    it("resolves nivel2/Foo without clasificaciones prefix in custom view", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "nivel1",
                value: "nivel2/Foo",
                isCustomView: true,
            }),
        ).toEqual({ field: "nivel2", value: "Foo" });
    });

    it("returns null for incomplete classification nivel2/null", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "nivel1",
                value: "nivel2/null",
                isCustomView: false,
            }),
        ).toBeNull();
    });

    it("returns null for empty value", () => {
        expect(resolveCasesFilterCriterion({ field: "reference", value: "", isCustomView: false })).toBeNull();
    });

    it("maps reference to numeric eq because cases.reference is integer", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "reference",
                value: "12345",
                isCustomView: false,
            }),
        ).toEqual({ field: "reference", value: 12345, operator: "eq" });
        expect(
            resolveCasesFilterCriterion({
                field: "reference",
                value: "INC-1",
                isCustomView: false,
            }),
        ).toBeNull();
    });

    it("maps estadoActual and estado_id to estados columns", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "estadoActual",
                value: "ESCALADO",
                isCustomView: false,
            }),
        ).toEqual({ field: "estados.nombre", value: "ESCALADO" });
        expect(
            resolveCasesFilterCriterion({
                field: "estado_id",
                value: "state-uuid",
                isCustomView: false,
            }),
        ).toEqual({ field: "estados.id", value: "state-uuid", operator: "eq" });
        expect(
            resolveCasesFilterCriterion({
                field: "grupo_id",
                value: "group-uuid",
                isCustomView: false,
            }),
        ).toEqual({ field: "grupo_id", value: "group-uuid", operator: "eq" });
    });

    it("maps grupo_nombre and responsable_nombre to joined tables", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "grupo_nombre",
                value: "BO",
                isCustomView: false,
            }),
        ).toEqual({ field: "grupos.nombre", value: "BO" });
        expect(
            resolveCasesFilterCriterion({
                field: "responsable_nombre",
                value: "Ana",
                isCustomView: false,
            }),
        ).toEqual({ field: "responsable.nombres", value: "Ana" });
    });

    it("keeps numeric values as numbers", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "assigned_to",
                value: 42,
                isCustomView: false,
            }),
        ).toEqual({ field: "assigned_to", value: 42 });
    });

    it("keeps switch values as numbers", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "is_active",
                value: 1,
                isCustomView: false,
            }),
        ).toEqual({ field: "is_active", value: 1 });
    });

    it("keeps object values without serializing them", () => {
        const value = { value: "7", label: "Ana" };
        expect(
            resolveCasesFilterCriterion({
                field: "responsable",
                value,
                isCustomView: false,
            }),
        ).toEqual({ field: "responsable", value });
    });
});

describe("createCasesFilterCriterionResolver", () => {
    it("binds isCustomView into a callback", () => {
        const resolve = createCasesFilterCriterionResolver({ isCustomView: false });
        expect(resolve({ field: "nivel1", value: "nivel4/X" })).toEqual({
            field: "clasificaciones.nivel4",
            value: "X",
        });
    });
});

describe("getMaxAvailableNivelLevel", () => {
    it("returns 10 when the schema exposes all classification levels (default/classic view)", () => {
        const schema = Array.from({ length: 10 }, (_, index) => ({ column_name: `nivel${index + 1}` }));
        expect(getMaxAvailableNivelLevel(schema)).toBe(10);
    });

    it("returns the highest present level for a partial custom view (e.g. nivel1..nivel5)", () => {
        const schema = [
            { column_name: "id" },
            { column_name: "nivel1" },
            { column_name: "nivel2" },
            { column_name: "nivel3" },
            { column_name: "nivel4" },
            { column_name: "nivel5" },
        ];
        expect(getMaxAvailableNivelLevel(schema)).toBe(5);
    });

    it("returns 0 when no nivel column is present in the schema", () => {
        expect(getMaxAvailableNivelLevel([{ column_name: "id" }, { column_name: "reference" }])).toBe(0);
    });

    it("returns 0 for an empty or missing schema", () => {
        expect(getMaxAvailableNivelLevel([])).toBe(0);
        expect(getMaxAvailableNivelLevel(undefined)).toBe(0);
    });
});
