import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";
import { RegexPatterns } from "@/utils/regex/RegexPatterns";

const requiredTextTypes = ["maskText", "concatenate", "concatenateComma", "regexOr"];
const requiredNumberTypes = ["increment", "divide", "subtract", "add"];
const requiredDateTypes = ["addMinutes", "addHours", "addDays", "subtractMinutes", "subtractHours", "subtractDays"];

const optionalFilterInputTypes = ["addToContext", "generateUUID"];

const base = {
    description: JoiHelper.legacyText({ max: 255 }).required(),
    type: JoiHelper.generalText({ max: 255 }).required(),
    filter_input: Joi.when("type", {
        is: Joi.valid(...optionalFilterInputTypes),
        then: Joi.any().optional().allow("", null),
        otherwise: JoiHelper.legacyText({ max: 255 }).required(),
    }),
    context_position: Joi.string().max(255).pattern(RegexPatterns.pathRegex()).required().messages({
        "string.pattern.base": "Formato inválido.",
    }),
    value_static: Joi.when("type", {
        is: "filterArray",
        then: Joi.string()
            .pattern(/^[a-zA-ZÀ-ž0-9\s#&()%._\-@':{};,~"‰/\\|+¿?¡!*[\]=]*$/)
            .required()
            .messages({
                "any.required": "restFunctions.requiredTextValue",
                "string.pattern.base": "Formato inválido. Use el formato campo=valor o campo!=valor",
            }),
        otherwise: Joi.when("type", {
            is: Joi.valid(...requiredTextTypes),
            then: JoiHelper.legacyText().required().messages({
                "any.required": "restFunctions.requiredTextValue",
            }),
            otherwise: Joi.when("type", {
                is: Joi.valid(...requiredNumberTypes),
                then: Joi.when("value_dynamic", {
                    is: Joi.valid(true),
                    then: JoiHelper.legacyText().required().messages({
                        "any.required": "restFunctions.requiredContextPath",
                    }),
                    otherwise: JoiHelper.integer().required().messages({
                        "any.required": "restFunctions.requiredNumericValue",
                        "number.base": "restFunctions.mustBeNumberForFunction",
                    }),
                }),
                otherwise: Joi.when("type", {
                    is: Joi.valid(...requiredDateTypes),
                    then: Joi.when("value_dynamic", {
                        is: Joi.valid(true),
                        then: JoiHelper.legacyText().required().messages({
                            "any.required": "restFunctions.requiredContextPath",
                        }),
                        otherwise: Joi.string()
                            .pattern(/^\d+(\.\d+)?(,[A-Za-z]+\/[A-Za-z_]+)?$/)
                            .required()
                            .messages({
                                "any.required": "restFunctions.requiredForFunction",
                                "string.pattern.base": 'Formato inválido. Use un número o "número,Zona/Horaria"',
                            }),
                    }),
                    otherwise: Joi.any().optional(),
                }),
            }),
        }),
    }),
    is_active: JoiHelper.boolean(),
};

export const WSRestFunctionsCreateSchema = Joi.object({
    ...base,
    id: JoiHelper.uuid().optional(),
}).strict();

export const WSRestFunctionsUpdateSchema = Joi.object({
    ...base,
    id: JoiHelper.uuid().required(),
}).strict();
