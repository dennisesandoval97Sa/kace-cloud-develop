import { secureCustomRule } from "@/utils/joiCustomRules";
import Joi from "joi";
import { SUPPORTED_TIMEZONES } from "@/constants/timezones";

const SCHEMA_FIELD_UI_INPUT_TYPES = [
    "text",
    "textarea",
    "select",
    "radio",
    "checkbox",
    "date",
    "datetime",
    "number",
    "currency",
    "email",
    "submit",
    "password",
];

const fieldUiSchema = Joi.object({
    label: Joi.string().max(100).allow("").default(""),
    css: Joi.string().max(100).allow("").default(""),
    input_type: Joi.string()
        .valid(...SCHEMA_FIELD_UI_INPUT_TYPES)
        .default("text"),
    show_in_grid: Joi.boolean().default(false),
    read_only: Joi.boolean().default(false),
    is_visible: Joi.boolean().default(true),
    ui_modified: Joi.boolean().default(false),
})
    .allow(null)
    .optional();

const validateDuplicatesInLists = (value, helpers, siblingFieldName, translationKey) => {
    const siblingValues = helpers.state.ancestors[0][siblingFieldName];

    if (!siblingValues || !value) {
        return value;
    }

    const siblingSet = new Set(
        siblingValues
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
    );
    const selfArr = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const duplicates = selfArr.filter((item) => siblingSet.has(item));

    if (duplicates.length > 0) {
        return helpers.error(translationKey, { value: duplicates.join(", ") });
    }

    return value;
};

// Un límite sólo aplica si es realmente numérico: Joi.exist() acepta null y rompe el ref.
const NUMERIC_LIMIT = Joi.number().required();
// El ref resuelve el valor crudo del hermano; el form puede entregarlo como string.
const numericRef = (key) => Joi.ref(key, { adjust: (value) => Number(value) });

const createNumberSchema = (fieldName) => {
    let schema = Joi.number()
        .allow(null)
        .when("integer", {
            is: true,
            then: Joi.number().integer(),
        })
        .when("numberSign", {
            is: "positive",
            then: Joi.number().min(0),
        })
        .when("numberSign", {
            is: "negative",
            then: Joi.number().max(0),
        });

    if (fieldName !== "min") {
        schema = schema.when("min", {
            is: NUMERIC_LIMIT,
            then: Joi.number().min(numericRef("min")).messages({
                "number.min": "any.mustBeGreaterThanMin",
            }),
        });
    }

    if (fieldName !== "max") {
        schema = schema.when("max", {
            is: NUMERIC_LIMIT,
            then: Joi.number().max(numericRef("max")).messages({
                "number.max": "any.mustBeLessThanMax",
            }),
        });
    }

    return schema.messages({
        "number.min": "number.positive",
        "number.max": "number.negative",
        "number.less": "any.mustBeLessThanMax",
        "number.greater": "any.mustBeGreaterThanMin",
    });
};

const baseFieldSchema = Joi.object({
    name: Joi.string()
        .required()
        .min(1)
        .max(45)
        .pattern(/^[a-zA-Z_][a-zA-Z0-9_-]*$/)
        .messages({
            "string.base": "Column name must be a string.",
            "string.empty": "Column name is required.",
            "any.required": "Column name is required.",
            "string.min": "Column name must be at least {#limit} character long.",
            "string.max": "Column name cannot be longer than {#limit} characters.",
            "string.pattern.base": "column.name.pattern",
        }),
    type: Joi.string()
        .valid("string", "number", "integer", "boolean", "date", "array", "object", "calculated")
        .required(),
    required: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()).allow(null).default(false),
    unique: Joi.boolean().default(false),
});

const fieldSchema = baseFieldSchema.keys({
    default: Joi.when("type", {
        switch: [
            {
                is: "string",
                then: Joi.string()
                    .custom(secureCustomRule())
                    .allow(null, "")
                    .when(Joi.ref("alphanum"), {
                        is: true,
                        then: Joi.string()
                            .pattern(/^[A-Za-z\d, ]*$/)
                            .messages({
                                "string.pattern.base": "string.alphanum",
                            }),
                        otherwise: Joi.string(),
                    })
                    .when("validationType", {
                        is: "ip",
                        then: Joi.when("IPv4", {
                            is: true,
                            then: Joi.when("IPv6", {
                                is: true,
                                then: Joi.string()
                                    .ip({
                                        version: ["ipv4", "ipv6"],
                                    })
                                    .messages({
                                        "string.ip": "string.ipv4andipv6",
                                        "string.ipVersion": "string.ipv4andipv6",
                                    }),
                                otherwise: Joi.string()
                                    .ip({
                                        version: "ipv4",
                                    })
                                    .messages({
                                        "string.ip": "string.ipv4",
                                        "string.ipVersion": "string.ipv4",
                                    }),
                            }),
                            otherwise: Joi.when("IPv6", {
                                is: true,
                                then: Joi.string()
                                    .ip({
                                        version: "ipv6",
                                    })
                                    .messages({
                                        "string.ip": "string.ipv6",
                                        "string.ipVersion": "string.ipv6",
                                    }),
                                otherwise: Joi.forbidden().messages({
                                    "any.unknown": "string.ipValidation",
                                }),
                            }),
                        }),
                    }),
            },
            {
                is: "number",
                then: createNumberSchema("default"),
            },
            {
                is: "boolean",
                then: Joi.boolean().allow(null).default(null),
            },
            {
                is: "date",
                then: Joi.alternatives().try(
                    Joi.date()
                        .allow(null)
                        .when("min", {
                            is: Joi.date().required(),
                            then: Joi.date().min(Joi.ref("min")),
                        })
                        .when("max", {
                            is: Joi.date().required(),
                            then: Joi.date().max(Joi.ref("max")),
                        })
                        .messages({
                            "date.min": "any.mustBeGreaterThanMin",
                            "date.max": "any.mustBeLessThanMax",
                        }),
                    Joi.string().allow("now", null),
                ),
                otherwise: Joi.forbidden(),
            },
        ],
    }),

    dataUri: Joi.when("type", {
        is: "string",
        then: Joi.boolean().default(false),
        otherwise: Joi.forbidden(),
    }),
    base64: Joi.when("type", {
        is: "string",
        then: Joi.boolean().default(false),
        otherwise: Joi.forbidden(),
    }),

    isFixedLength: Joi.when("type", {
        is: "string",
        then: Joi.boolean(),
        otherwise: Joi.forbidden(),
    }),
    length: Joi.when("type", {
        is: "string",
        then: Joi.number().integer().positive().allow(null).messages({
            "number.base": "auxSchema.error.mustBeNumber",
        }),
        otherwise: Joi.forbidden(),
    }),
    validationType: Joi.when("type", {
        is: "string",
        then: Joi.string().allow(null, ""),
        otherwise: Joi.allow(null),
    }),
    pattern: Joi.when("type", {
        is: "string",
        then: Joi.object({
            regex: Joi.string()
                .custom((value, helpers) => {
                    try {
                        RegExp(value);
                        return value;
                    } catch {
                        // NO-SONAR: Si la expresión regular es inválida, se maneja el error devolviendo un mensaje estándar ("any.invalid")
                        return helpers.error("any.invalid");
                    }
                })
                .messages({
                    "any.invalid": "pattern.regex",
                }),
            flags: Joi.string()
                .allow("")
                .pattern(/^[gimsuy]*$/)
                .message("pattern.invalidFlags")
                .custom((value, helpers) => {
                    const uniqueFlags = new Set(value.split(""));
                    if (uniqueFlags.size !== value.length) {
                        return helpers.error("any.invalid");
                    }
                    return value;
                })
                .messages({
                    "any.invalid": "pattern.duplicateFlags",
                }),
        }),
        otherwise: Joi.forbidden(),
    }),

    numberSign: Joi.when("type", {
        is: Joi.valid("number", "integer"),
        then: Joi.string().valid("positive", "negative", "both").allow(null, ""),
        otherwise: Joi.forbidden(),
    }),
    positive: Joi.when("type", {
        is: Joi.valid("number", "integer"),
        then: Joi.boolean(),
        otherwise: Joi.forbidden(),
    }),
    integer: Joi.when("type", {
        is: "number",
        then: Joi.boolean(),
        otherwise: Joi.forbidden(),
    }),
    precision: Joi.when("type", {
        is: "number",
        then: Joi.number().allow(null).messages({
            "number.base": "auxSchema.error.mustBeNumber",
        }),
        otherwise: Joi.forbidden(),
    }),
    port: Joi.when("type", {
        is: Joi.valid("number", "integer"),
        then: Joi.boolean(),
        otherwise: Joi.forbidden(),
    }),
    min: Joi.when("type", {
        switch: [
            {
                is: Joi.valid("number", "integer", "string"),
                then: createNumberSchema("min"),
            },
            {
                is: "date",
                then: Joi.alternatives().try(Joi.date().allow(null), Joi.string().allow("now", null)),
                otherwise: Joi.forbidden(),
            },
        ],
    }),
    max: Joi.when("type", {
        switch: [
            {
                is: Joi.valid("number", "integer", "string"),
                then: Joi.number()
                    .allow(null)
                    .messages({
                        "number.base": "auxSchema.error.mustBeNumber",
                    })
                    .when("min", {
                        is: NUMERIC_LIMIT,
                        then: createNumberSchema("max"),
                    }),
            },
            {
                is: "date",
                then: Joi.alternatives().try(
                    Joi.date().greater(Joi.ref("min")).messages({
                        "date.greater": "any.mustBeGreaterThanMin",
                    }),
                    Joi.string().allow("now", null),
                ),
                otherwise: Joi.forbidden(),
            },
        ],
    }),

    truthyValues: Joi.when("type", {
        is: "boolean",
        then: Joi.string()
            .pattern(/^[A-Za-z\d, ]*$/)
            .allow(null, "")
            .messages({
                "string.pattern.base": "string.alphanum",
            })
            .custom((value, helpers) => {
                return validateDuplicatesInLists(value, helpers, "falsyValues", "boolean.dulicatedTruthyFalsy");
            }),
        otherwise: Joi.forbidden(),
    }),
    falsyValues: Joi.when("type", {
        is: "boolean",
        then: Joi.string()
            .pattern(/^[A-Za-z\d, ]*$/)
            .allow(null, "")
            .messages({
                "string.pattern.base": "string.alphanum",
            })
            .custom((value, helpers) => {
                return validateDuplicatesInLists(value, helpers, "truthyValues", "boolean.dulicatedTruthyFalsy");
            }),
        otherwise: Joi.forbidden(),
    }),

    schema_id: Joi.when("type", {
        is: Joi.valid("array", "object"),
        then: Joi.string().uuid().required().messages({
            "string.empty": "any.required",
            "string.guid": "any.required",
            "string.base": "any.required",
        }),
        otherwise: Joi.forbidden(),
    }),

    timestamp: Joi.when("type", {
        is: "date",
        then: Joi.when("iso", {
            is: false,
            then: Joi.string().valid("javascript", "unix").default("javascript").required(),
            otherwise: Joi.string().valid("javascript", "unix").allow(null, "").optional(),
        }),
        otherwise: Joi.forbidden(),
    }),
    iso: Joi.when("type", {
        is: "date",
        then: Joi.boolean().default(false),
        otherwise: Joi.forbidden(),
    }),
    timezoneFormat: Joi.when("type", {
        is: "date",
        then: Joi.when("iso", {
            is: true,
            then: Joi.string().valid("withTimezone", "withoutTimezone").default("withoutTimezone").required(),
            otherwise: Joi.string().valid("withTimezone", "withoutTimezone").allow(null, "").optional(),
        }),
        otherwise: Joi.forbidden(),
    }),
    timezone: Joi.when("type", {
        is: "date",
        then: Joi.when("iso", {
            is: true,
            then: Joi.when(Joi.ref("timezoneFormat"), {
                is: "withoutTimezone",
                then: Joi.string()
                    .valid(...SUPPORTED_TIMEZONES)
                    .required()
                    .messages({
                        "string.empty": "timezoneRequired",
                        "any.required": "timezoneRequired",
                    }),
                otherwise: Joi.string().allow(null, ""),
            }),
            otherwise: Joi.string().allow(null, ""),
        }),
        otherwise: Joi.forbidden(),
    }),

    uri: Joi.when("type", {
        is: "string",
        then: Joi.object({
            scheme: Joi.string().allow(null, "", "http", "https"),
            allowRelative: Joi.boolean(),
        }),
        otherwise: Joi.forbidden(),
    }),

    valid: Joi.when("type", {
        switch: [
            {
                is: "string",
                then: Joi.string()
                    .pattern(/^[A-Za-z\d, ]*$/)
                    .allow(null, "")
                    .messages({
                        "string.pattern.base": "string.alphanum",
                    })
                    .custom((value, helpers) => {
                        return validateDuplicatesInLists(value, helpers, "invalid", "any.duplicatedValidInvalid");
                    }),
            },
            {
                is: Joi.valid("number", "integer"),
                then: Joi.string()
                    .pattern(/^[-\d., ]*$/)
                    .allow(null, "")
                    .messages({
                        "string.pattern.base": "string.numberList",
                    })
                    .custom((value, helpers) => {
                        return validateDuplicatesInLists(value, helpers, "invalid", "any.duplicatedValidInvalid");
                    }),
                otherwise: Joi.forbidden(),
            },
        ],
    }),
    invalid: Joi.when("type", {
        switch: [
            {
                is: "string",
                then: Joi.string()
                    .pattern(/^[A-Za-z\d, ]*$/)
                    .allow(null, "")
                    .messages({
                        "string.pattern.base": "string.alphanum",
                    })
                    .custom((value, helpers) => {
                        return validateDuplicatesInLists(value, helpers, "valid", "any.duplicatedValidInvalid");
                    }),
            },
            {
                is: Joi.valid("number", "integer"),
                then: Joi.string()
                    .pattern(/^[-\d., ]*$/)
                    .allow(null, "")
                    .messages({
                        "string.pattern.base": "string.numberList",
                    })
                    .custom((value, helpers) => {
                        return validateDuplicatesInLists(value, helpers, "valid", "any.duplicatedValidInvalid");
                    }),
                otherwise: Joi.forbidden(),
            },
        ],
    }),
    restFlow: Joi.when("type", {
        is: Joi.valid("string", "number", "integer", "boolean", "date"),
        then: Joi.string().uuid().allow(null, ""),
        otherwise: Joi.forbidden(),
    }),

    regexReplace: Joi.when("type", {
        is: "string",
        then: Joi.array().items(
            Joi.object({
                regex: Joi.string()
                    .custom((value, helpers) => {
                        try {
                            RegExp(value);
                            return value;
                        } catch {
                            // NO-SONAR: Si la expresión regular es inválida, se maneja el error devolviendo un mensaje estándar ("any.invalid")
                            return helpers.error("any.invalid");
                        }
                    })
                    .messages({
                        "any.invalid": "pattern.regex",
                    }),
                string: Joi.string().custom(secureCustomRule()),
            }),
        ),
        otherwise: Joi.forbidden(),
    }),

    email: Joi.when("type", {
        is: "string",
        then: Joi.object({
            minDomainSegments: Joi.number().min(1),
            tlds: Joi.object({
                allow: Joi.alternatives()
                    .try(
                        Joi.string()
                            .pattern(/^[A-Za-z\d, ]*$/)
                            .allow(null, "")
                            .messages({
                                "string.pattern.base": "string.alphanum",
                            }),
                        Joi.array().items(Joi.string()),
                    )
                    .when(Joi.ref("validationType"), { is: "email", then: Joi.required() }),
            }),
        }),
        otherwise: Joi.forbidden(),
    }),

    calc: Joi.when("type", {
        is: "calculated",
        then: Joi.object({
            formula: Joi.string().required(),
            params: Joi.array().items(
                Joi.object({
                    isRef: Joi.boolean().required(),
                    value: Joi.alternatives().required().try(Joi.string(), Joi.number(), Joi.boolean()),
                }),
            ),
        }),
        otherwise: Joi.forbidden(),
    }),

    ui: fieldUiSchema,

    dependency: Joi.boolean().default(false),
    dependencyValueValidation: Joi.boolean()
        .default(false)
        .when("dependency", {
            is: false,
            then: Joi.boolean().valid(false).messages({
                "any.only": "dependencyValue.requiresDependency",
            }),
        }),
    dependencyValue: Joi.string()
        .allow(null, "")
        .when("dependencyValueValidation", {
            is: true,
            then: Joi.string().required().min(1).messages({
                "string.empty": "dependencyValue.required",
                "any.required": "dependencyValue.required",
                "string.min": "dependencyValue.required",
            }),
            otherwise: Joi.string().allow(null, ""),
        }),
    dependsOn: Joi.string()
        .allow(null, "")
        .when("dependency", {
            is: true,
            then: Joi.string().required().messages({
                "string.empty": "dependsOn.required",
                "any.required": "dependsOn.required",
            }),
            otherwise: Joi.allow(null, ""),
        })
        .messages({
            "any.invalid": "dependsOn.invalid",
        }),
});

const base = Joi.object({
    name: Joi.string().required().min(1).max(45).messages({
        "string.empty": "any.required",
    }),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    fields: Joi.array().items(fieldSchema).default([]),
});

export const AuxSchemaCreateSchema = base.keys({
    id: Joi.string().uuid().optional(),
});
