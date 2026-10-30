import { describe, expect, it } from "vitest";
import { identityFilterOperator, isIdentityFilterField } from "./identityFilterField";

describe("isIdentityFilterField", () => {
    it.each([
        ["id"],
        ["cases.id"],
        ["responsable_id"],
        ["rel_usuarios_grupos.grupo_id"],
        ["created_by"],
        ["updated_by"],
        ["edited_by"],
        ["deleted_by"],
        ["clients.padre_id"],
    ])("treats %j as an identity column", (field) => {
        expect(isIdentityFilterField(field)).toBe(true);
        expect(identityFilterOperator(field)).toBe("eq");
    });

    it.each([
        ["nombre"],
        ["cases.subject"],
        ["client_identifier"],
        ["documento"],
        ["external_code"],
        ["apellido1"],
        ["created_at"],
        [""],
        [null],
        [undefined],
    ])("does not treat %j as an identity column", (field) => {
        expect(isIdentityFilterField(field)).toBe(false);
        expect(identityFilterOperator(field)).toBeNull();
    });
});
