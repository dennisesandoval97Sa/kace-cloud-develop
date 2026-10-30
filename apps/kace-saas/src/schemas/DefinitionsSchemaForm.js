import Joi from "joi";
import { secureCustomRule } from "@/utils/joiCustomRules";

const RESERVED_NAMES = ["clients", "cases", "schemas", "definitions"];

const isValidName = (t, isCreate) => (value, helpers) => {
    const regex = /^[a-z_]+$/;
    if (!regex.test(value)) {
        return helpers.error("string.pattern.base", {
            message: t("validations.nameOnlyLowercaseUnderscore"),
        });
    }
    if (isCreate && RESERVED_NAMES.includes(value.toLowerCase())) {
        return helpers.error("any.invalid", {
            message: t("validations.nameContainsReservedWord"),
        });
    }
    return value;
};

const getBaseSchema = (t, isCreate) => ({
    id: Joi.string().uuid(),
    name: Joi.string()
        .min(1)
        .max(50)
        .custom(isValidName(t, isCreate), "Validación de nombre")
        .custom(secureCustomRule())
        .required()
        .messages({
            "string.empty": t("validations.nameIsRequired"),
            "string.pattern.base": t("validations.nameInvalid"),
            "any.invalid": t("validations.nameContainsReservedWord"),
        }),
    schema_id: Joi.string()
        .uuid()
        .required()
        .messages({
            "string.empty": t("validations.mustSelectSchema"),
        }),
    restflow_id: Joi.string()
        .uuid()
        .messages({
            "string.empty": t("validations.mustSelectRestFlow"),
        }),
    is_active: Joi.alternatives()
        .try(Joi.number().valid(0, 1), Joi.boolean())
        .required(),
    logs_tablename: Joi.string().optional(),
    tablename: Joi.string().optional(),
});

export const DefinitionSchemaForm = (t, isCreate) => Joi.object(getBaseSchema(t, isCreate));
