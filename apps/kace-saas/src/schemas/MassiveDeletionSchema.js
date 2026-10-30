import Joi from "joi";

const jsonPropertySchema = Joi.object({
    id: Joi.string().required(),
    name: Joi.string()
        .required()
        .pattern(/^[a-zA-Z_][a-zA-Z0-9_-]*$/)
        .messages({
            "string.empty": "jsonEditor.name.required",
            "any.required": "jsonEditor.name.required",
            "string.pattern.base": "jsonEditor.name.pattern",
        }),
    type: Joi.string()
        .valid("string", "number", "boolean", "object", "array")
        .required()
        .messages({
            "any.required": "jsonEditor.type.required",
        }),
    value: Joi.any().when("type", {
        switch: [
            {
                is: "string",
                then: Joi.string().allow("").default(""),
            },
            {
                is: "number",
                then: Joi.number().allow(null).default(null),
            },
            {
                is: "boolean",
                then: Joi.boolean().default(false),
            },
            {
                is: "object",
                then: Joi.array().items(Joi.link("#jsonProperty")).default([]),
            },
            {
                is: "array",
                then: Joi.array().items(Joi.link("#jsonProperty")).default([]),
            },
        ],
        otherwise: Joi.any().strip(),
    }),
}).id("jsonProperty");

export const MassiveDeletionSchema = Joi.object({
    properties: Joi.array()
        .items(jsonPropertySchema)
        .default([]),
});
