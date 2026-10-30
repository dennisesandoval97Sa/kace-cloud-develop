import Joi from 'joi';

const TIME_PATTERN = new RegExp(String.raw`^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$`);

/**
 * Convert a time string ("HH:MM" or "HH:MM:SS") to seconds since 00:00
 * @param {string} timeStr
 * @returns {number}
 */
const timeToSeconds = (timeStr) => {
    const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
};

/**
 * @param {object} value
 * @param {Joi.CustomHelpers} helpers
 */
const timeValidation = (value, helpers) => {
    const startTimeInSeconds = timeToSeconds(value.start_time);
    const endTimeInSeconds = timeToSeconds(value.end_time);

    if (startTimeInSeconds >= endTimeInSeconds) {
        return helpers.message('The end time must be greater than the start time');
    }

    return value;
};

const schemaBase = Joi.object({
    description: Joi.string().max(255).required(),
    start_time: Joi.string().pattern(TIME_PATTERN).required(),
    end_time: Joi.string().pattern(TIME_PATTERN).required(),
    agenda_id: Joi.string().uuid().required(),
    is_active: Joi.boolean().default(true),
    max_appointments: Joi.number().integer().min(0).required(),
}).custom(timeValidation, 'timeValidation');

export const createSchema = schemaBase.keys({
    id: Joi.string().uuid().required(),
    created_at: Joi.date().timestamp(),
    created_by: Joi.string().uuid(),
});

export const updateSchema = schemaBase.keys({
    updated_at: Joi.date().timestamp(),
    updated_by: Joi.string().uuid(),
});
