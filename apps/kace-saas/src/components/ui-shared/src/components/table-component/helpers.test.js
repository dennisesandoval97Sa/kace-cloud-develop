import { describe, expect, it } from "vitest";
import {
    resolveDateFilterOperator,
    pickRestorableFilterValues,
    removeSavedUserFilter,
    validateFilters,
    getScopedViewFilters,
    seedScopeFromLegacyAdmin,
    FILTER_SCOPES,
    DEFAULT_FILTER_SCOPE,
} from "./helpers";

describe("FILTER_SCOPES", () => {
    it("defines AGENTE and ADMIN scopes and DEFAULT_FILTER_SCOPE", () => {
        expect(FILTER_SCOPES.AGENTE).toBe("agente");
        expect(FILTER_SCOPES.ADMIN).toBe("admin");
        expect(DEFAULT_FILTER_SCOPE).toBe(FILTER_SCOPES.AGENTE);
        expect(Object.isFrozen(FILTER_SCOPES)).toBe(true);
    });
});

describe("resolveDateFilterOperator", () => {
    it("returns between for fecha_vencimiento and other fecha_* fields", () => {
        expect(resolveDateFilterOperator("fecha_vencimiento")).toBe("between");
        expect(resolveDateFilterOperator("fecha_resolucion")).toBe("between");
        expect(resolveDateFilterOperator("fecha")).toBe("between");
    });

    it("returns between for known timestamp columns", () => {
        expect(resolveDateFilterOperator("created_at")).toBe("between");
        expect(resolveDateFilterOperator("updated_at")).toBe("between");
        expect(resolveDateFilterOperator("start_at")).toBe("between");
        expect(resolveDateFilterOperator("end_at")).toBe("between");
    });

    it("treats receipt_at as a between date filter", () => {
        expect(resolveDateFilterOperator("receipt_at")).toBe("between");
    });

    it("treats start_date and end_date as between date filters", () => {
        expect(resolveDateFilterOperator("start_date")).toBe("between");
        expect(resolveDateFilterOperator("end_date")).toBe("between");
    });

    it("treats occurred_at as a between date filter", () => {
        expect(resolveDateFilterOperator("occurred_at")).toBe("between");
    });

    it("treats edited_at as a between date filter", () => {
        expect(resolveDateFilterOperator("edited_at")).toBe("between");
    });

    it("returns null for non-date columns", () => {
        expect(resolveDateFilterOperator("reference")).toBeNull();
        expect(resolveDateFilterOperator("nivel1")).toBeNull();
    });
});

describe("validateFilters", () => {
    it("initializes application scope path safely", () => {
        const user = {};
        validateFilters(user, "cases", FILTER_SCOPES.AGENTE);
        expect(user.filters.application.agente.cases).toEqual({});
    });

    it("defaults to AGENTE scope when scope is omitted", () => {
        const user = {};
        validateFilters(user, "cases");
        expect(user.filters.application.agente.cases).toEqual({});
    });

    it("does not throw when dataUser is null or undefined", () => {
        expect(() => validateFilters(null, "cases")).not.toThrow();
        expect(() => validateFilters(undefined, "cases")).not.toThrow();
    });
});

describe("getScopedViewFilters", () => {
    it("returns the requested scope's filters when they exist and are non-empty", () => {
        const filters = {
            application: {
                agente: { cases: { Mine: { reference: "1" } } },
                admin: { cases: { Legacy: { reference: "9" } } },
            },
        };
        expect(getScopedViewFilters(filters, "cases", FILTER_SCOPES.AGENTE)).toEqual({
            Mine: { reference: "1" },
        });
    });

    it("falls back to admin filters when the agente scope is missing", () => {
        const filters = { application: { admin: { cases: { Legacy: { reference: "9" } } } } };
        expect(getScopedViewFilters(filters, "cases", FILTER_SCOPES.AGENTE)).toEqual({
            Legacy: { reference: "9" },
        });
    });

    it("does NOT fall back to admin when the agente scope exists but is empty (e.g. every agente filter was deleted)", () => {
        const filters = {
            application: {
                agente: { cases: {} },
                admin: { cases: { Legacy: { reference: "9" } } },
            },
        };
        expect(getScopedViewFilters(filters, "cases", FILTER_SCOPES.AGENTE)).toEqual({});
    });

    it("defaults to DEFAULT_FILTER_SCOPE (agente) when scope is omitted", () => {
        const filters = { application: { agente: { cases: { Mine: { reference: "1" } } } } };
        expect(getScopedViewFilters(filters, "cases")).toEqual({ Mine: { reference: "1" } });
    });

    it("does not fall back to admin when scope is admin and admin has no filters", () => {
        const filters = { application: { agente: { cases: { Mine: { reference: "1" } } } } };
        expect(getScopedViewFilters(filters, "cases", FILTER_SCOPES.ADMIN)).toEqual({});
    });

    it("returns an empty object when filters is null or undefined", () => {
        expect(getScopedViewFilters(null, "cases")).toEqual({});
        expect(getScopedViewFilters(undefined, "cases")).toEqual({});
    });
});

describe("seedScopeFromLegacyAdmin", () => {
    const buildNextFilters = (agenteCases, adminCases) => ({
        application: {
            [FILTER_SCOPES.AGENTE]: { cases: agenteCases },
            [FILTER_SCOPES.ADMIN]: { cases: adminCases },
        },
    });

    it("seeds the agente bucket with a copy of admin's legacy filters on the first-ever agente save", () => {
        const nextFilters = buildNextFilters({}, { Legacy: { reference: "5" } });

        seedScopeFromLegacyAdmin(nextFilters, "cases", FILTER_SCOPES.AGENTE, false);

        expect(nextFilters.application.agente.cases).toEqual({ Legacy: { reference: "5" } });
        expect(nextFilters.application.admin.cases).toEqual({ Legacy: { reference: "5" } });
    });

    it("does not mutate admin's original filter objects (deep clone)", () => {
        const legacy = { reference: "5" };
        const nextFilters = buildNextFilters({}, { Legacy: legacy });

        seedScopeFromLegacyAdmin(nextFilters, "cases", FILTER_SCOPES.AGENTE, false);
        nextFilters.application.agente.cases.Legacy.reference = "mutated";

        expect(legacy.reference).toBe("5");
        expect(nextFilters.application.admin.cases.Legacy.reference).toBe("5");
    });

    it("does not seed when the agente bucket already existed before this write (even if empty)", () => {
        const nextFilters = buildNextFilters({}, { Legacy: { reference: "5" } });

        seedScopeFromLegacyAdmin(nextFilters, "cases", FILTER_SCOPES.AGENTE, true);

        expect(nextFilters.application.agente.cases).toEqual({});
    });

    it("does not seed for the admin scope, regardless of scopeViewExistedBeforeInit", () => {
        const nextFilters = buildNextFilters({}, { Legacy: { reference: "5" } });

        seedScopeFromLegacyAdmin(nextFilters, "cases", FILTER_SCOPES.ADMIN, false);

        expect(nextFilters.application.agente.cases).toEqual({});
    });

    it("is a no-op when admin has no filters for that view", () => {
        const nextFilters = buildNextFilters({}, {});

        seedScopeFromLegacyAdmin(nextFilters, "cases", FILTER_SCOPES.AGENTE, false);

        expect(nextFilters.application.agente.cases).toEqual({});
    });

    it("is a no-op when admin has no bucket at all for that view", () => {
        const nextFilters = { application: { agente: { cases: {} }, admin: {} } };

        expect(() => seedScopeFromLegacyAdmin(nextFilters, "cases", FILTER_SCOPES.AGENTE, false)).not.toThrow();
        expect(nextFilters.application.agente.cases).toEqual({});
    });
});

describe("pickRestorableFilterValues", () => {
    it("keeps only keys present in known columns", () => {
        expect(
            pickRestorableFilterValues({ reference: "A", ghost: "x", nivel1: "nivel2/Foo" }, ["reference", "nivel1"]),
        ).toEqual({ reference: "A", nivel1: "nivel2/Foo" });
    });

    it("unwraps object descriptor value property when present", () => {
        const saved = {
            nivel1: { field: "nivel1", value: "Reclasificación 1", operator: "eq", type: "AND" },
            reference: "12345",
        };
        expect(pickRestorableFilterValues(saved, ["nivel1", "reference"])).toEqual({
            nivel1: "Reclasificación 1",
            reference: "12345",
        });
    });

    it("returns empty object when nothing matches", () => {
        expect(pickRestorableFilterValues({ a: 1 }, ["b"])).toEqual({});
    });

    it("handles null or non-object safely", () => {
        expect(pickRestorableFilterValues(null, ["a"])).toEqual({});
        expect(pickRestorableFilterValues(undefined, ["a"])).toEqual({});
        expect(pickRestorableFilterValues("string", ["a"])).toEqual({});
    });
});

describe("removeSavedUserFilter", () => {
    const base = {
        application: {
            admin: {
                cases: {
                    Mine: { reference: "1" },
                    Other: { reference: "2" },
                },
            },
        },
    };

    it("removes the named filter without mutating the original", () => {
        const next = removeSavedUserFilter(base, "cases", "Mine");
        expect(next.application.admin.cases).toEqual({ Other: { reference: "2" } });
        expect(base.application.admin.cases.Mine).toEqual({ reference: "1" });
    });

    it("is a no-op when name or view is missing", () => {
        expect(removeSavedUserFilter(base, "cases", "Nope")).toBe(base);
        expect(removeSavedUserFilter({}, "cases", "Mine")).toEqual({});
        expect(removeSavedUserFilter(undefined, "cases", "Mine")).toBeUndefined();
    });

    it("removes a named entry even when its stored value is falsy", () => {
        const withEmpty = {
            application: {
                admin: {
                    cases: {
                        Empty: "",
                        Other: { reference: "2" },
                    },
                },
            },
        };
        const next = removeSavedUserFilter(withEmpty, "cases", "Empty");
        expect(next.application.admin.cases).toEqual({ Other: { reference: "2" } });
        expect(withEmpty.application.admin.cases).toHaveProperty("Empty");
    });

    it("removes a named entry from agente scope when specified", () => {
        const agenteFilters = {
            application: {
                agente: {
                    cases: {
                        AgentFilter: { reference: "1" },
                        Other: { reference: "2" },
                    },
                },
                admin: {
                    cases: {
                        AdminFilter: { reference: "9" },
                    },
                },
            },
        };
        const next = removeSavedUserFilter(agenteFilters, "cases", "AgentFilter", FILTER_SCOPES.AGENTE);
        expect(next.application.agente.cases).toEqual({ Other: { reference: "2" } });
        expect(next.application.admin.cases).toEqual({ AdminFilter: { reference: "9" } });
        expect(agenteFilters.application.agente.cases).toHaveProperty("AgentFilter");
    });
});
