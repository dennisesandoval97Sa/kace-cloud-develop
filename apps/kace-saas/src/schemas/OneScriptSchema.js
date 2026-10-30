import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const noScript = (value, helpers) => {
    if (value.toLowerCase().includes("script")) {
        return helpers.error("any.invalid", { value });
    }
    return value;
};

const baseSchema = {
    name: JoiHelper.legacyText({ min: 10, max: 255 }).custom(noScript).message("nameContainsScript").required(),
    url: JoiHelper.uri({ max: 255 }).required(),
    url_api: JoiHelper.uri({ max: 255 }).required(),
    schema_id: JoiHelper.uuid().optional().allow(null),
    onescript_reference_id: JoiHelper.uuid().required().messages({
        "any.required": "oneScriptFormIdRequired",
        "string.empty": "oneScriptFormIdRequired",
    }),
};

export const OneScriptSchemaForm = Joi.object(baseSchema).strict();
export const OneScriptCreateSchema = Joi.object({ ...baseSchema, id: JoiHelper.uuid().required() }).strict();
export const OneScriptUpdateSchema = Joi.object({ ...baseSchema }).strict();
