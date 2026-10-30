import { describe, expect, it } from "vitest";
import { getComponentKey } from "./getComponentKey";

describe("getComponentKey", () => {
    it("routes known datetime columns to CellDate", () => {
        expect(getComponentKey("created_at")).toBe("date");
        expect(getComponentKey("updated_at")).toBe("date");
        expect(getComponentKey("fecha_vencimiento")).toBe("date");
        expect(getComponentKey("sla_due_date")).toBe("date");
        expect(getComponentKey("edited_at")).toBe("date");
    });

    it("does not treat arbitrary _at/_date suffixes as date cells", () => {
        expect(getComponentKey("look_at")).not.toBe("date");
        expect(getComponentKey("birth_date")).not.toBe("date");
        expect(getComponentKey("custom_updated_at_note")).not.toBe("date");
    });

    it("routes the board access columns to the chip list cell", () => {
        // Un typo en el Set dejaria las columnas de acceso pintando ids crudos, sin error.
        expect(getComponentKey("groups")).toBe("groups");
        expect(getComponentKey("access_users")).toBe("groups");
        expect(getComponentKey("access_groups")).toBe("groups");
    });
});
