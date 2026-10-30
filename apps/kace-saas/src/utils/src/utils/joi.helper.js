import Joi from "joi";
import { RegexPatterns } from "@/utils/regex/RegexPatterns.js";
import { crontab } from "@/utils/joiCustomRules";

export const JoiHelper = {
    uuid: () => Joi.string().uuid({ version: "uuidv4" }),

    generalText: (options = {}) =>
        Joi.string()
            .trim()
            .min(options.min || 2)
            .max(options.max || 100)
            .pattern(RegexPatterns.generalText())
            .message("string.generalText"),

    freeText: (options = {}) =>
        Joi.string()
            .trim()
            .min(options.min || 3)
            .max(options.max || 255)
            .pattern(RegexPatterns.freeText())
            .message("string.freeText"),

    htmlText: (options = {}) =>
        Joi.string()
            .trim()
            .min(options.min || 3)
            .max(options.max || 5000)
            .pattern(RegexPatterns.extendedHtmlRegex())
            .message("string.extendedCharactersRegex"),

    legacyText: (options = {}) =>
        Joi.string()
            .trim()
            .min(options.min || 1)
            .max(options.max || 255)
            .pattern(RegexPatterns.extendedCharactersRegex())
            .message("string.extendedCharactersRegex"),

    description: (options = {}) =>
        Joi.string()
            .trim()
            .min(options.min || 3)
            .max(options.max || 100)
            .pattern(RegexPatterns.descriptionRegex())
            .message("string.description"),

    onlyLetters: (options = {}) =>
        Joi.string()
            .trim()
            .min(options.min || 2)
            .max(options.max || 100)
            .pattern(RegexPatterns.onlyLetters())
            .messages({
                "string.pattern.base": "string.onlyLetters",
                "string.trim": "validations.string.trim",
            }),

    identifier: (options = {}) =>
        Joi.string()
            .trim()
            .min(options.min || 3)
            .max(options.max || 100)
            .pattern(RegexPatterns.snakeCase())
            .message("string.identifier"),

    alphaNumericCode: (options = {}) =>
        Joi.string()
            .trim()
            .min(options.min || 1)
            .max(options.max || 200)
            .pattern(RegexPatterns.alphaNumericCode())
            .message("string.alphaNumericCode"),

    /** Matches ValueObjectExternalCode in @kace/core (extendedCharactersRegex, max 100). */
    externalCode: (options = {}) =>
        Joi.string()
            .trim()
            .min(options.min || 1)
            .max(options.max || 100)
            .pattern(RegexPatterns.externalCodeRegex())
            .message("string.extendedCharactersRegex"),

    constantCase: (options = {}) =>
        Joi.string()
            .trim()
            .max(options.max || 255)
            .pattern(/^[A-Z_\d-]+$/)
            .message("string.constantCase"),

    snakeCase: (options = {}) =>
        Joi.string()
            .trim()
            .max(options.max || 255)
            .pattern(/^[a-z0-9_]+$/)
            .message("string.snakeCases"),

    color: () => Joi.string().trim().pattern(RegexPatterns.colorRegex()).message("string.color"),

    email: () => Joi.string().email({ tlds: { allow: false } }),

    emailList: (options = {}) =>
        Joi.string()
            .max(options.max || 30000)
            .custom((value, helpers) => {
                if (RegexPatterns.emailList().test(value)) {
                    return value;
                }
                return helpers.message(
                    "Debe ser un correo electrónico válido, una variable, o una lista de correos separados por coma.",
                );
            }),

    phone: (options = {}) => JoiHelper.generalText({ min: 7, max: 20, ...options }),

    localPhone: () =>
        Joi.string()
            .trim()
            .length(10)
            .pattern(/^[0-9]+$/)
            .messages({
                "string.pattern.base": "string.localPhone",
                "any.invalid": "string.localPhone",
                "string.length": "string.length",
            }),

    documentNumber: () =>
        Joi.string().custom((value, helpers) => {
            if (/\s/.test(value)) return helpers.message("No se permiten espacios en blanco");
            if (helpers.state.ancestors[0].tipo_documento?.includes("CEDULA") && !/^\d+$/.test(value)) {
                return helpers.message("Solo debe ingresar números");
            }
            return value;
        }),

    boolean: () => Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),

    integer: (options = {}) => {
        let schema = Joi.number().integer().messages({
            "number.base": "number.base",
            "number.integer": "number.integer",
            "number.min": "number.min",
            "number.max": "number.max",
        });
        if (options.min !== undefined) schema = schema.min(options.min);
        if (options.max !== undefined) schema = schema.max(options.max);

        return schema;
    },

    date: (options = {}) => {
        let schema = Joi.date();
        if (options.iso) schema = schema.iso();
        return schema;
    },

    crontab: () => Joi.string().custom(crontab()).max(30),

    internalPath: (options = {}) =>
        Joi.string()
            .max(options.max || 1024)
            .pattern(/^([\w-]+)(\/[\w-.]+)*$/)
            .message("string.internalPath"),

    timeHHMM: () =>
        Joi.string()
            .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
            .message("string.timeHHMM"),

    timeHHMMSS: () =>
        Joi.string()
            .pattern(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/)
            .message("string.timeHHMMSS"),

    host: () => Joi.string().trim().pattern(RegexPatterns.hostRegex()).message("string.host"),

    uri: (options = {}) =>
        Joi.string()
            .uri()
            .max(options.max || 255)
            .messages({ "string.uri": "string.uri" }),
};
