import Joi from 'joi';

const timeValidation = (value, helpers) => {
    if (value.start_time >= value.end_time) {
        return helpers.message('The start time cannot be greater than or equal to the end time.');
    }
    if (value.start_time < new Date().getTime()) {
        return helpers.message('The start time cannot be in the past.');
    }
    if (value.end_time < new Date().getTime()) {
        return helpers.message('The end time cannot be in the past.');
    }
    return value;
};

const schemaBase = Joi.object({
    case_id: Joi.string().uuid().required(),
    agenda_id: Joi.string().uuid().required(),
    group_id: Joi.string().uuid().required(),
    date: Joi.date().required(),
    start_time: Joi.date().timestamp().required(),
    end_time: Joi.date().timestamp().greater(Joi.ref('start_time')).required().messages({
        'date.greater': 'The end time must be greater than the start time.',
    }),
    last_appointment_id: Joi.string().uuid().allow(null),
    is_completed: Joi.boolean().default(false),
    is_canceled: Joi.boolean().default(false),
    custom_fields: Joi.object().allow(null),
    assigned_to: Joi.string().uuid().allow(null),
});

export const createSchema = schemaBase
    .keys({
        id: Joi.string().uuid().required(),
        created_at: Joi.date().timestamp(),
        created_by: Joi.string().uuid(),
    })
    .custom(timeValidation, 'Time validation');

export const updateSchema = schemaBase
    .keys({
        updated_at: Joi.date().timestamp(),
        updated_by: Joi.string().uuid(),
    })
    .custom(timeValidation, 'Time validation');

export const rescheduleSchema = schemaBase
    .keys({
        id: Joi.string().uuid().required(),
        created_by: Joi.string().uuid().required(),
        updated_by: Joi.string().uuid(),
        created_at: Joi.date().timestamp(),
        updated_at: Joi.date().timestamp(),
    })
    .custom(timeValidation, 'Time validation');
