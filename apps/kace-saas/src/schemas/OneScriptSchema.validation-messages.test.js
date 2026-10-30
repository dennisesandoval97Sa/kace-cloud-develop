import { describe, it, expect, beforeAll, afterEach } from "vitest";
import i18n from "i18next";
import { OneScriptSchemaForm } from "./OneScriptSchema";
import { joiFormikAdapter } from "@/utils/src/joiFormikAdapter";

const adapter = joiFormikAdapter(OneScriptSchemaForm);

const validOneScript = {
    name: "Valid integration name",
    url: "https://example.com/onescript",
    url_api: "https://example.com/api",
    schema_id: null,
    onescript_reference_id: "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
};

async function getFieldError(data, field) {
    try {
        await adapter.validate(data);
        return null;
    } catch (e) {
        return e.inner.find((err) => err.path === field)?.message ?? null;
    }
}

describe("OneScriptSchemaForm nameContainsScript validation messages", () => {
    beforeAll(async () => {
        await i18n.changeLanguage("es");
    });

    it("shows a translated Spanish message when name contains 'script'", async () => {
        const message = await getFieldError({ ...validOneScript, name: "My script runner" }, "name");

        expect(message).toBe("El nombre no puede contener la palabra 'script'");
        expect(message).not.toContain("validations.nameContainsScript");
    });

    it.each(["My script runner", "My Script runner", "SCRIPT-123 integration", "PostScrIPT service"])(
        "rejects the name '%s' regardless of casing (noScript is case-insensitive)",
        async (name) => {
            const message = await getFieldError({ ...validOneScript, name }, "name");

            expect(message).toBe("El nombre no puede contener la palabra 'script'");
        },
    );

    it("accepts a valid name without the reserved word", async () => {
        await expect(adapter.validate(validOneScript)).resolves.toBeUndefined();
    });

    it("shows a translated English message when locale is en", async () => {
        await i18n.changeLanguage("en");
        const message = await getFieldError({ ...validOneScript, name: "My script runner" }, "name");

        expect(message).toBe("The name cannot contain the word 'script'");
        await i18n.changeLanguage("es");
    });
});

describe("OneScriptSchemaForm onescript_reference_id validation messages", () => {
    beforeAll(async () => {
        await i18n.changeLanguage("es");
    });

    afterEach(async () => {
        await i18n.changeLanguage("es");
    });

    it.each([
        ["empty", { ...validOneScript, onescript_reference_id: "" }],
        ["missing", (({ onescript_reference_id: _omitted, ...rest }) => rest)(validOneScript)],
    ])("shows the field-specific required message when the form ID is %s", async (_label, data) => {
        expect(await getFieldError(data, "onescript_reference_id")).toBe("Ingrese el ID del formulario OneScript");
    });

    it("shows a translated message instead of the raw Joi GUID error for a non-UUID form ID", async () => {
        const message = await getFieldError(
            { ...validOneScript, onescript_reference_id: "form-123" },
            "onescript_reference_id",
        );

        expect(message).toBe("Debe ser un identificador válido (UUID)");
    });

    it("shows the English messages when locale is en", async () => {
        await i18n.changeLanguage("en");

        expect(await getFieldError({ ...validOneScript, onescript_reference_id: "" }, "onescript_reference_id")).toBe(
            "Enter the OneScript form ID",
        );
        expect(
            await getFieldError({ ...validOneScript, onescript_reference_id: "form-123" }, "onescript_reference_id"),
        ).toBe("Must be a valid UUID");
    });
});
