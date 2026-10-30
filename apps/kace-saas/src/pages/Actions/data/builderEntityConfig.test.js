import { describe, expect, it } from "vitest";
import { resolveBuilderEntityConfig } from "./builderEntityConfig";

describe("resolveBuilderEntityConfig", () => {
    it("returns the users configuration for cases.responsable_id", () => {
        const config = resolveBuilderEntityConfig("cases.responsable_id");

        expect(config).not.toBeNull();
        expect(config.kind).toBe("users");
        expect(config.searchFields).toEqual(["nombres", "apellido1", "apellido2"]);
        expect(config.baseFilter).toEqual([
            { field: "usuarios.deleted_at", operator: "null", value: "null", type: "AND" },
        ]);
        expect(config.searchPlaceholder).toBe("actions.querybuilder.responsablePlaceholder");
    });

    it("returns the states configuration for cases.estadoActual", () => {
        const config = resolveBuilderEntityConfig("cases.estadoActual");

        expect(config).not.toBeNull();
        expect(config.kind).toBe("states");
        expect(config.labelField).toBe("nombre");
        expect(config.searchFields).toBeUndefined();
        expect(config.baseFilter).toBeUndefined();
    });

    it("returns the classifications configuration for clasificaciones.description", () => {
        const config = resolveBuilderEntityConfig("clasificaciones.description");

        expect(config).not.toBeNull();
        expect(config.kind).toBe("classifications");
        expect(config.labelField).toBe("description");
        expect(config.searchFields).toBeUndefined();
    });

    it("returns null for fields without a builder Select", () => {
        expect(resolveBuilderEntityConfig("clasificaciones.other")).toBeNull();
        expect(resolveBuilderEntityConfig("unmapped.field")).toBeNull();
        expect(resolveBuilderEntityConfig(undefined)).toBeNull();
        expect(resolveBuilderEntityConfig(null)).toBeNull();
        expect(resolveBuilderEntityConfig("")).toBeNull();
    });

    it("returns a frozen configuration object", () => {
        const config = resolveBuilderEntityConfig("cases.responsable_id");

        expect(Object.isFrozen(config)).toBe(true);
        expect(Object.isFrozen(config.searchFields)).toBe(true);
        expect(Object.isFrozen(config.baseFilter)).toBe(true);
        expect(Object.isFrozen(config.keyQuery)).toBe(true);
    });
});
