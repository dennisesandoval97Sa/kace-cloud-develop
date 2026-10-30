import Joi from "joi";

const groupSchema = Joi.object({
    id: Joi.string().uuid().required(),
}).unknown();

const GroupListBase = {
    descripcion: Joi.string().min(3).max(255).required(),
    is_active: Joi.alternatives().try(
        Joi.number().valid(0, 1),
        Joi.boolean(),
    ),
};

export const GroupListCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    lista_grupos: Joi.array().items(groupSchema),
    ...GroupListBase,
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const GroupListUpdateSchema = Joi.object({
    ...GroupListBase,
    lista_grupos: Joi.array().items(groupSchema),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
