import { afterEach, beforeAll, describe, expect, it } from "vitest";
import Joi from "joi";
import i18n from "i18next";
import { joiFormikAdapter } from "./joiFormikAdapter";
import { createBoardCasesBulkCloseSchema } from "@/schemas/CasoSchema";

const columnNameSchema = Joi.object({
    name: Joi.string().required().messages({
        "string.empty": "Column name is required.",
        "any.required": "Column name is required.",
    }),
});

const defaultEmptySchema = Joi.object({
    close_reason: Joi.string().required(),
});

async function getFieldError(adapter, data, field) {
    try {
        await adapter.validate(data);
        return null;
    } catch (error) {
        return error.inner.find((err) => err.path === field)?.message ?? null;
    }
}

describe("joiFormikAdapter string.empty does not override declared messages", () => {
    beforeAll(async () => {
        await i18n.changeLanguage("en");
    });

    afterEach(async () => {
        await i18n.changeLanguage("en");
    });

    it("keeps a schema-declared English literal instead of validations.string.empty", async () => {
        const message = await getFieldError(joiFormikAdapter(columnNameSchema), { name: "" }, "name");

        expect(message).toBe("Column name is required.");
        expect(message).not.toBe("This field is required");
    });

    it("keeps a pre-translated validations.nameIsRequired message", async () => {
        const schema = Joi.object({
            name: Joi.string()
                .required()
                .messages({
                    "string.empty": i18n.t("validations.nameIsRequired"),
                }),
        });

        const message = await getFieldError(joiFormikAdapter(schema), { name: "" }, "name");

        expect(message).toBe("The name is required");
        expect(message).not.toBe("This field is required");
    });

    it("translates the default Joi empty message via validations.string.empty", async () => {
        const message = await getFieldError(joiFormikAdapter(defaultEmptySchema), { close_reason: "" }, "close_reason");

        expect(message).toBe("This field is required");
    });

    it("still translates default Joi min-length via validations.string.min", async () => {
        const schema = Joi.object({
            name: Joi.string().min(3).required(),
        });
        const message = await getFieldError(joiFormikAdapter(schema), { name: "ab" }, "name");

        expect(message).toBe("Minimum 3 characters");
    });

    it("resolves a declared i18n key that lives outside validations.*", async () => {
        const schema = Joi.object({
            precision: Joi.number().required().messages({
                "number.base": "auxSchema.error.mustBeNumber",
            }),
        });

        const message = await getFieldError(joiFormikAdapter(schema), { precision: "x" }, "precision");

        expect(message).toBe("Must be a valid number");
        expect(message).not.toBe("auxSchema.error.mustBeNumber");
    });

    it("falls back to the type translation when a dotted i18n key does not resolve", async () => {
        const schema = Joi.object({
            name: Joi.string().required().messages({
                "string.empty": "missing.schema.key",
            }),
        });

        const message = await getFieldError(joiFormikAdapter(schema), { name: "" }, "name");

        expect(message).toBe("This field is required");
        expect(message).not.toBe("missing.schema.key");
    });

    it("uses validations.jsonEditor.name.required for the massive-deletion name key", async () => {
        const schema = Joi.object({
            name: Joi.string().required().messages({
                "string.empty": "jsonEditor.name.required",
            }),
        });

        const message = await getFieldError(joiFormikAdapter(schema), { name: "" }, "name");

        expect(message).toBe("Property name is required");
    });

    it("uses validations.closeReasonRequired for the boards close schema", async () => {
        await i18n.changeLanguage("es");
        const message = await getFieldError(
            joiFormikAdapter(createBoardCasesBulkCloseSchema()),
            { close_reason: "" },
            "close_reason",
        );

        expect(message).toBe("El motivo de cierre es obligatorio");
        expect(message).not.toBe("Este campo es obligatorio");
    });
});
