import Joi from "joi";

const base = {
    client_id: Joi.string().uuid(),
    subject: Joi.string().max(25),
    message: Joi.string().max(1000),
    start_date: Joi.date().iso(),
    end_date: Joi.date().iso(),
    is_read: Joi.boolean().allow(null).optional(),
    read_by: Joi.string().uuid().allow(null).optional(),
    is_active: Joi.alternatives().try(
        Joi.number().valid(0, 1),
        Joi.boolean(),
    ),
};

export const ClientNotificationCreateSchema = Joi.object({
    id: Joi.string().uuid(),
    ...base,
    client_id: base.client_id.required(),
    created_at: Joi.date().iso(),
    created_by: Joi.string().uuid(),
});

export const ClientNotificationUpdateSchema = Joi.object({
    ...base,
    updated_at: Joi.date().iso(),
    updated_by: Joi.string().uuid(),
});
