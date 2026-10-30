import Joi from "joi"

const certificateSchema = Joi.when("has_ssl", {
    switch: [
        {
            is: Joi.valid(true, 1).required(),
            then: Joi.string().required()
        },
        {
            is: Joi.valid(false, 0).required(),
            then: Joi.string().valid(null, "").optional()
        }
    ],
    otherwise: Joi.string().optional()
})

const formCertificateSchema = Joi.when("has_ssl", {
    switch: [
        {
            is: Joi.valid(true, 1).required(),
            then: Joi.string().required()
        },
        {
            is: Joi.valid(false, 0).required(),
            then: Joi.string().valid(null, "").optional()
        }
    ],
    otherwise: Joi.string().allow(null, "").optional()
})

const base = {
    description: Joi.string().max(255),
    connection: Joi.string().max(255),
    certificate: certificateSchema,
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    has_ssl: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean())
}

export const AllowedConnectionCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null)
})

export const AllowedConnectionUpdateSchema = Joi.object({
    ...base,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null)
})
export const AllowedConnectionForm = Joi.object({
    description: Joi.string().max(255).min(3).required(),
    connection: Joi.string().max(255).required(),
    has_ssl: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    certificate: formCertificateSchema,
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean())
})
