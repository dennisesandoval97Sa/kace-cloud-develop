import { describe, expect, it } from "vitest";
import { ClassificationSchemaForm, ClassificationUpdateSchema } from "./ClassificationSchema";

const FLOW_ID = "11111111-1111-4111-8111-111111111111";
const ANS_ID = "22222222-2222-4222-8222-222222222222";
const FOLIO_CONFIG_ID = "33333333-3333-4333-8333-333333333333";

const classification = (overrides = {}) => ({ nivel1: "Soporte", flujo_id: FLOW_ID, ans_id: ANS_ID, ...overrides });

describe("ClassificationSchema — folio_config_id", () => {
    it.each([
        ["un uuid", FOLIO_CONFIG_ID],
        // El select clearable envía "" al desasociar la configuración.
        ["una cadena vacía", ""],
        ["null", null],
    ])("acepta %s", (_label, value) => {
        expect(ClassificationSchemaForm.validate(classification({ folio_config_id: value })).error).toBeUndefined();
        expect(ClassificationUpdateSchema.validate({ folio_config_id: value }).error).toBeUndefined();
    });

    it("es opcional", () => {
        expect(ClassificationSchemaForm.validate(classification()).error).toBeUndefined();
    });

    it("rechaza un valor que no es uuid", () => {
        const { error } = ClassificationSchemaForm.validate(classification({ folio_config_id: "no-es-uuid" }));

        expect(error?.details[0].path).toEqual(["folio_config_id"]);
    });
});
