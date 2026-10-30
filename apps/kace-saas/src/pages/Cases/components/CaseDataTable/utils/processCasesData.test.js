import { describe, it, expect, vi } from "vitest";

const { getSchemaFilterSpy } = vi.hoisted(() => ({ getSchemaFilterSpy: vi.fn() }));

vi.mock("@/services/createSchemaFilter", async (importOriginal) => {
    const actual = await importOriginal();
    getSchemaFilterSpy.mockImplementation(actual.getSchemaFilter);
    return { ...actual, getSchemaFilter: getSchemaFilterSpy };
});

const {
    attachMaxLevelToClassificationField,
    buildCustomViewFilterSchema,
    buildCustomViewVisibleSchema,
    filterVisibleColumns,
    getCustomViewHiddenFields,
    normalizeVisibleColumns,
    processCasesColumns,
    processCasesData,
    processSchema,
} = await import("./processCasesData");
const { SPECIAL_FIELDS } = await import("@/services/createSchemaFilter");

describe("normalizeVisibleColumns", () => {
    it("removes other nivel columns when an expandable clasificacion root exists", () => {
        const columns = [
            { column_name: "nivel1", header_label: "Clasificación", cell_type: "clasificacion", expand_levels: true },
            { column_name: "nivel2", header_label: "Nivel 2", cell_type: "clasificacion" },
            { column_name: "reference", header_label: "Ref", cell_type: "default" },
        ];

        expect(normalizeVisibleColumns(columns).map((c) => c.column_name)).toEqual(["nivel1", "reference"]);
    });

    it("keeps multiple nivel columns when clasificacion is single-column mode", () => {
        const columns = [
            { column_name: "nivel5", header_label: "Nivel 5", cell_type: "clasificacion", expand_levels: false },
            { column_name: "nivel6", header_label: "Nivel 6", cell_type: "clasificacion", expand_levels: false },
        ];

        expect(normalizeVisibleColumns(columns)).toHaveLength(2);
    });
});

describe("filterVisibleColumns", () => {
    const schema = [
        { column_name: "reference", label: "Reference", data_type: "string" },
        { column_name: "estadoactual", label: "Estado Actual", data_type: "string" },
        { column_name: "nombres", label: "Nombres", data_type: "string" },
        { column_name: "nivel2", label: "Nivel 2", data_type: "string" },
        { column_name: "nivel3", label: "Nivel 3", data_type: "string" },
    ];

    it("returns full schema when visibleColumns is empty", () => {
        expect(filterVisibleColumns(schema, [])).toEqual(schema);
    });

    it("filters correctly by column_name and injects metadata", () => {
        const visibleColumns = [
            { column_name: "reference", header_label: "Ref", cell_type: "text" },
            { column_name: "estadoactual", header_label: "Status", cell_type: "status" },
        ];
        const result = filterVisibleColumns(schema, visibleColumns);
        expect(result).toHaveLength(2);
        expect(result[0].column_name).toBe("reference");
        expect(result[0].header_label).toBe("Ref");
        expect(result[0].cell_type).toBe("text");
        expect(result[1].column_name).toBe("estadoactual");
        expect(result[1].header_label).toBe("Status");
        expect(result[1].cell_type).toBe("status");
    });

    it("preserves order from visibleColumns array, not schema order", () => {
        const visibleColumns = [
            { column_name: "nombres", header_label: "Name", cell_type: "text" },
            { column_name: "reference", header_label: "Ref", cell_type: "text" },
            { column_name: "estadoactual", header_label: "Status", cell_type: "status" },
        ];
        const result = filterVisibleColumns(schema, visibleColumns);
        expect(result.map((c) => c.column_name)).toEqual(["nombres", "reference", "estadoactual"]);
    });

    it("silently omits column_name not found in schema", () => {
        const visibleColumns = [
            { column_name: "reference", header_label: "Ref", cell_type: "text" },
            { column_name: "nonexistent", header_label: "Invalid", cell_type: "text" },
            { column_name: "estadoactual", header_label: "Status", cell_type: "status" },
        ];
        const result = filterVisibleColumns(schema, visibleColumns);
        expect(result).toHaveLength(2);
        expect(result.map((c) => c.column_name)).toEqual(["reference", "estadoactual"]);
    });

    it("excludes other nivel columns when expandable clasificacion root is configured", () => {
        const schemaWithLevels = [
            ...schema,
            { column_name: "nivel1", label: "Nivel 1", data_type: "string" },
            { column_name: "nivel5", label: "Nivel 5", data_type: "string" },
        ];
        const visibleColumns = [
            { column_name: "reference", header_label: "Ref", cell_type: "text" },
            { column_name: "nivel5", header_label: "Clasificación", cell_type: "clasificacion", expand_levels: true },
            { column_name: "nivel2", header_label: "Nivel 2", cell_type: "clasificacion" },
        ];
        const result = filterVisibleColumns(schemaWithLevels, visibleColumns);
        expect(result.map((c) => c.column_name)).toEqual(["reference", "nivel5"]);
        expect(result[1].expand_levels).toBe(true);
    });

    it("injects separator when provided in visibleColumns", () => {
        const visibleColumns = [{ column_name: "reference", header_label: "Ref", cell_type: "text", separator: "|" }];
        const result = filterVisibleColumns(schema, visibleColumns);
        expect(result).toHaveLength(1);
        expect(result[0].separator).toBe("|");
    });

    it("includes id when explicitly configured in visibleColumns", () => {
        const schemaWithId = [...schema, { column_name: "id", label: "Id", data_type: "number" }];
        const visibleColumns = [{ column_name: "id", header_label: "id", cell_type: "default" }];

        const result = filterVisibleColumns(schemaWithId, visibleColumns);

        expect(result).toHaveLength(1);
        expect(result[0].column_name).toBe("id");
        expect(result[0].header_label).toBe("id");
    });
});

describe("getCustomViewHiddenFields", () => {
    it("hides optional system fields when they are not selected", () => {
        expect(getCustomViewHiddenFields([])).toEqual([
            "deleted_at",
            "deleted_by",
            "id",
            "responsable_id",
            "cliente_id",
        ]);
    });

    it("keeps id visible when it is selected in visibleColumns", () => {
        expect(getCustomViewHiddenFields([{ column_name: "id", header_label: "id", cell_type: "default" }])).toEqual([
            "deleted_at",
            "deleted_by",
            "responsable_id",
            "cliente_id",
        ]);
    });
});

describe("buildCustomViewFilterSchema", () => {
    const fullSchema = [
        { column_name: "reference", label: "Reference", data_type: "string" },
        { column_name: "nombres", label: "Nombres", data_type: "string" },
        { column_name: "estadoactual", label: "Estado", data_type: "string" },
    ];

    it("adds reference to filter schema when it is not in visible columns", () => {
        const visibleSchema = [{ column_name: "nombres", label: "Nombres", data_type: "string" }];

        expect(buildCustomViewFilterSchema(visibleSchema, fullSchema).map((column) => column.column_name)).toEqual([
            "reference",
            "nombres",
        ]);
    });

    it("does not duplicate reference when it is already visible", () => {
        const visibleSchema = [
            { column_name: "nombres", label: "Nombres", data_type: "string" },
            { column_name: "reference", label: "Reference", data_type: "string" },
        ];

        expect(buildCustomViewFilterSchema(visibleSchema, fullSchema).map((column) => column.column_name)).toEqual([
            "nombres",
            "reference",
        ]);
    });
});

describe("buildCustomViewVisibleSchema", () => {
    const schemaWithSystemFields = [
        { column_name: "id", label: "Id", data_type: "number" },
        { column_name: "reference", label: "Reference", data_type: "string" },
        { column_name: "deleted_at", label: "Deleted At", data_type: "datetime" },
    ];

    it("includes id in custom view when configured in visibleColumns", () => {
        const visibleColumns = [{ column_name: "id", header_label: "id", cell_type: "default" }];

        const result = buildCustomViewVisibleSchema(schemaWithSystemFields, visibleColumns);

        expect(result.map((column) => column.column_name)).toEqual(["id"]);
    });

    it("keeps default hidden system fields when visibleColumns is empty", () => {
        const result = buildCustomViewVisibleSchema(schemaWithSystemFields, []);

        expect(result.map((column) => column.column_name)).not.toContain("id");
        expect(result.map((column) => column.column_name)).toContain("reference");
    });

    it("resolves headers through the Cases i18n namespace (visibleColumns empty branch)", () => {
        getSchemaFilterSpy.mockClear();
        buildCustomViewVisibleSchema(schemaWithSystemFields, []);

        expect(getSchemaFilterSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            "columnsCases",
        );
    });

    it("resolves headers through the Cases i18n namespace (visibleColumns non-empty branch)", () => {
        getSchemaFilterSpy.mockClear();
        buildCustomViewVisibleSchema(schemaWithSystemFields, [{ column_name: "reference" }]);

        expect(getSchemaFilterSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            "columnsCases",
        );
    });
});

describe("processCasesColumns", () => {
    it("filters string UUID id columns with eq, not ilike", () => {
        const columns = Object.values(
            processCasesColumns(true)({}, [
                { column_name: "id", data_type: "string" },
                { column_name: "responsable_id", data_type: "string" },
                { column_name: "nombres", data_type: "string" },
            ]),
        );

        expect(columns.find((column) => column.column_name === "id").filterData.operator).toBe("eq");
        expect(columns.find((column) => column.column_name === "responsable_id").filterData.operator).toBe("eq");
        expect(columns.find((column) => column.column_name === "nombres").filterData.operator).toBe("ilike");
    });
});

describe("processSchema", () => {
    it("resolves headers through the Cases i18n namespace", () => {
        getSchemaFilterSpy.mockClear();
        processSchema([{ column_name: "reference", label: "Reference", data_type: "string" }]);

        expect(getSchemaFilterSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            "columnsCases",
        );
    });
});

describe("processCasesData", () => {
    const caseRow = {
        id: 1,
        nombres: "Ana",
        apellido1: "Pérez",
        apellido2: "López",
        tipo_cliente: "Natural",
        nombre_cliente: "Cliente",
        primer_apellido: "Prueba",
        segundo_apellido: "Uno",
        antiguedad_dias: 1,
        antiguedad_horas: 2,
        antiguedad_minutos: 3,
        antiguedad: "Tiempo laboral transcurrido: 1 día 2 horas 3 minutos",
        remaining_time: "Remaining time: 4 hours",
        subcasos: 1,
    };

    it("keeps time description prefixes when show_time_description_prefixes is true", () => {
        const [result] = processCasesData(false, false, null, true)([{ ...caseRow }]);

        expect(result.antiguedad).toBe("Tiempo laboral transcurrido: 1 día 2 horas 3 minutos");
        expect(result.remaining_time).toBe("Remaining time: 4 hours");
        expect(String(result.antiguedad_dias)).toMatch(/tiempo transcurrido:|Time elapsed:/i);
        expect(result.hasSubcases).toBe(true);
    });

    it("strips time description prefixes when show_time_description_prefixes is false", () => {
        const [result] = processCasesData(false, false, null, false)([{ ...caseRow }]);

        expect(result.antiguedad).toBe("1 día 2 horas 3 minutos");
        expect(result.remaining_time).toBe("4 hours");
        expect(String(result.antiguedad_dias)).not.toMatch(/tiempo transcurrido:|Time elapsed:/i);
        expect(String(result.antiguedad_dias)).toContain("1");
        expect(result.hasSubcases).toBe(true);
    });
});

describe("attachMaxLevelToClassificationField", () => {
    it("attaches maxLevel to the classification_levels (ByLevel) filter field", () => {
        const schemaFields = [
            { column_name: "reference", field: "string" },
            { column_name: "nivel1", field: SPECIAL_FIELDS.classification_levels },
        ];

        const result = attachMaxLevelToClassificationField(schemaFields, 5);

        expect(result.find((f) => f.column_name === "nivel1")).toMatchObject({ maxLevel: 5 });
        expect(result.find((f) => f.column_name === "reference")).not.toHaveProperty("maxLevel");
    });

    it("is a no-op when there is no classification_levels field in the schema", () => {
        const schemaFields = [{ column_name: "reference", field: "string" }];
        expect(attachMaxLevelToClassificationField(schemaFields, 5)).toEqual(schemaFields);
    });

    it("handles an empty schema", () => {
        expect(attachMaxLevelToClassificationField([], 5)).toEqual([]);
    });
});
