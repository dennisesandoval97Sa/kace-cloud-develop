import { describe, it, expect } from "vitest";
import { ActionSchemaForm } from "./ActionSchema";

const buildValidPayload = (overrides = {}) => ({
    action_type: "asignar_grupo_por_codigo_externo",
    description: "Asignar grupo por código externo",
    conditions: {},
    triggers: [],
    priority: 1,
    is_active: true,
    external_group_code: "GRP-01",
    ...overrides,
});

describe("ActionSchemaForm external codes", () => {
    it("accepts special characters in external_group_code", async () => {
        const payload = buildValidPayload({ external_group_code: "GRP-01/ÁREA#2" });
        await expect(ActionSchemaForm.validateAsync(payload)).resolves.toBeDefined();
    });

    it("accepts special characters in external_user_code", async () => {
        const payload = buildValidPayload({
            action_type: "asignar_usuario_por_codigo_externo",
            external_group_code: undefined,
            external_user_code: "USR.01|CO+¿?",
        });
        await expect(ActionSchemaForm.validateAsync(payload)).resolves.toBeDefined();
    });

    it("rejects characters outside the backend extendedCharactersRegex set", async () => {
        const payload = buildValidPayload({ external_group_code: "code<script>" });
        await expect(ActionSchemaForm.validateAsync(payload)).rejects.toBeDefined();
    });

    it("rejects external_group_code longer than 100 characters", async () => {
        const payload = buildValidPayload({ external_group_code: "a".repeat(101) });
        await expect(ActionSchemaForm.validateAsync(payload)).rejects.toBeDefined();
    });
});
