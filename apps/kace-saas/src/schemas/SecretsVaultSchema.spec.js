import { describe, expect, it } from "vitest";
import { SecretsVaultCreateSchemaForm } from "./SecretsVaultSchema";

describe("SecretsVaultCreateSchemaForm", () => {
    it("allows password symbols including @ in secret values", () => {
        const result = SecretsVaultCreateSchemaForm.validate({
            descripcion: "KACE RestFlow callback password",
            referencia: "KACE_RESTFLOW_CALLBACK_PASSWORD",
            secreto: "KaceRestFlow@Password=123",
        });

        expect(result.error).toBeUndefined();
    });
});
