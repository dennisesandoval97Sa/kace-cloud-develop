import { describe, it, expect, vi, beforeEach } from "vitest";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const { mockTranslateRef } = vi.hoisted(() => ({ mockTranslateRef: { current: (key) => key } }));

vi.mock("i18next", () => ({ t: (key) => mockTranslateRef.current(key) }));

const {
    getSchemaFilter,
    resolveGridColumnHeader,
    getCasesHeaderNamespace,
    resolveNamespacedColumnLabel,
    SPECIAL_FIELDS,
} = await import("./createSchemaFilter");

beforeEach(() => {
    mockTranslateRef.current = (key) => key;
});

describe("getSchemaFilter reference as number", () => {
    it("maps reference to number when forced via fields config", () => {
        const result = getSchemaFilter(
            [{ column_name: "reference", label: "Reference", data_type: "string" }],
            [{ column_name: "reference", field: SPECIAL_FIELDS.number }],
            [],
        );

        expect(result).toEqual([
            expect.objectContaining({
                column_name: "reference",
                data_type: SPECIAL_FIELDS.number,
            }),
        ]);
    });

    it("maps edited_by to the same user search input as created_by", () => {
        const result = getSchemaFilter(
            [
                { column_name: "created_by", label: "Created by", data_type: "String" },
                { column_name: "edited_by", label: "Edited by", data_type: "String" },
            ],
            [],
            [],
        );

        expect(result.find((column) => column.column_name === "created_by")).toEqual(
            expect.objectContaining({ data_type: SPECIAL_FIELDS.search_users }),
        );
        expect(result.find((column) => column.column_name === "edited_by")).toEqual(
            expect.objectContaining({ data_type: SPECIAL_FIELDS.search_users }),
        );
    });

    it("maps edited_at to a date filter even when the schema type is string", () => {
        const result = getSchemaFilter([{ column_name: "edited_at", label: "Edited at", data_type: "String" }], [], []);

        expect(result).toEqual([
            expect.objectContaining({
                column_name: "edited_at",
                data_type: SPECIAL_FIELDS.date,
            }),
        ]);
    });
});

describe("resolveGridColumnHeader", () => {
    const translate = (key) =>
        ({
            "gridMain.columns.Edited at": "Última gestión",
            "gridMain.columns.Edited by": "Gestionado por",
            "gridMain.columns.Created at": "Cuándo se creó el caso",
        })[key] ?? key;

    it("translates edited fields when admin schema has no label", () => {
        expect(resolveGridColumnHeader({ column_name: "edited_at", label: "undefined" }, translate)).toBe(
            "Última gestión",
        );
        expect(resolveGridColumnHeader({ column_name: "edited_by", label: undefined }, translate)).toBe(
            "Gestionado por",
        );
    });

    it("keeps created_at aligned with the nivel-1 date copy", () => {
        expect(resolveGridColumnHeader({ column_name: "created_at", label: "Created at" }, translate)).toBe(
            "Cuándo se creó el caso",
        );
    });

    it("replaces every underscore, not just the first, when building the toAgentFilterLabel candidate", () => {
        const multiUnderscoreTranslate = (key) =>
            key === "gridMain.columns.Antiguedad dias promedio" ? "Promedio de antigüedad" : key;

        expect(
            resolveGridColumnHeader(
                { column_name: "antiguedad_dias_promedio", label: undefined },
                multiUnderscoreTranslate,
            ),
        ).toBe("Promedio de antigüedad");
    });
});

describe("resolveGridColumnHeader namespace override", () => {
    const namespacedTranslate = (key) =>
        ({
            "gridMain.columnsCases.Created at": "Cuándo se creó el caso",
            "gridMain.columns.Created at": "Created",
            "gridMain.columns.Current state": "Current state",
        })[key] ?? key;

    it("prefers the namespaced key over the shared gridMain.columns key when given a namespace", () => {
        expect(
            resolveGridColumnHeader(
                { column_name: "created_at", label: "Created at" },
                namespacedTranslate,
                "columnsCases",
            ),
        ).toBe("Cuándo se creó el caso");
    });

    it("falls back to the shared gridMain.columns key when the namespace has no match for the candidate", () => {
        expect(
            resolveGridColumnHeader(
                { column_name: "reference", label: "Reference" },
                namespacedTranslate,
                "columnsCases",
            ),
        ).toBe("Reference");
    });

    it("keeps the default (no namespace) behavior unchanged", () => {
        expect(resolveGridColumnHeader({ column_name: "created_at", label: "Created at" }, namespacedTranslate)).toBe(
            "Created",
        );
    });
});

describe("getCasesHeaderNamespace", () => {
    it("returns columnsCases for the main /cases grid config (matches on entity)", () => {
        expect(getCasesHeaderNamespace({ key: URL_AND_KEYS.cases.key, entity: URL_AND_KEYS.cases.entity })).toBe(
            "columnsCases",
        );
    });

    it("returns columnsCases for AdminCaseSubCases (per-case key, Cases entity)", () => {
        expect(getCasesHeaderNamespace({ key: "subcases-case-123", entity: URL_AND_KEYS.cases.entity })).toBe(
            "columnsCases",
        );
    });

    it("returns columnsCases for a saved custom Cases view (Cases key, custom entity)", () => {
        expect(getCasesHeaderNamespace({ key: URL_AND_KEYS.cases.key, entity: "view_case_admin" })).toBe(
            "columnsCases",
        );
    });

    it("returns undefined for a non-Cases table (e.g. roles)", () => {
        expect(getCasesHeaderNamespace({ key: "roles", entity: "roles" })).toBeUndefined();
    });

    it("returns undefined for a missing or empty config", () => {
        expect(getCasesHeaderNamespace(null)).toBeUndefined();
        expect(getCasesHeaderNamespace(undefined)).toBeUndefined();
        expect(getCasesHeaderNamespace({})).toBeUndefined();
    });
});

describe("resolveNamespacedColumnLabel", () => {
    const translate = (key) =>
        ({
            "gridMain.columnsCases.Created at": "Cuándo se creó el caso",
            "gridMain.columns.Created at": "Created",
            "gridMain.columns.Reference": "Reference",
        })[key] ?? key;

    it("prefers the namespaced key when it translates", () => {
        expect(resolveNamespacedColumnLabel(translate, "Created at", "columnsCases")).toBe("Cuándo se creó el caso");
    });

    it("falls back to the shared gridMain.columns key when the namespace has no match", () => {
        expect(resolveNamespacedColumnLabel(translate, "Reference", "columnsCases")).toBe("Reference");
    });

    it("returns null when neither the namespaced nor the shared key translates", () => {
        expect(resolveNamespacedColumnLabel(translate, "Nonexistent", "columnsCases")).toBeNull();
    });

    it("skips the namespace check entirely when namespace is falsy", () => {
        const translateSpy = (key) => (key === "gridMain.columns.Created at" ? "Created" : key);
        expect(resolveNamespacedColumnLabel(translateSpy, "Created at", null)).toBe("Created");
    });
});

describe("getSchemaFilter namespace param", () => {
    const schema = [{ column_name: "created_at", label: "Created at", data_type: "date" }];

    it("resolves headers through the Cases namespace when given one", () => {
        mockTranslateRef.current = (key) =>
            ({
                "gridMain.columnsCases.Created at": "Cuándo se creó el caso",
                "gridMain.columns.Created at": "Created",
            })[key] ?? key;

        const [field] = getSchemaFilter(schema, [], [], "columnsCases");
        expect(field.header).toBe("Cuándo se creó el caso");
    });

    it("existing callers that omit the namespace keep resolving through the shared key only", () => {
        mockTranslateRef.current = (key) =>
            ({
                "gridMain.columnsCases.Created at": "Cuándo se creó el caso",
                "gridMain.columns.Created at": "Created",
            })[key] ?? key;

        const [field] = getSchemaFilter(schema, [], []);
        expect(field.header).toBe("Created");
    });
});
