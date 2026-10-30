import Joi from 'joi';

// SONAR-EXC: Se omite S5843 porque esta regex debe validar minutos en CRON (0–59) con rangos, listas y pasos.
const REGEX_MINUTE =
    /^(\*(?:\/[0-5]?\d)?|[0-5]?\d(?:-[0-5]?\d)?(?:\/[0-5]?\d)?)(?:,(\*(?:\/[0-5]?\d)?|[0-5]?\d(?:-[0-5]?\d)?(?:\/[0-5]?\d)?))*$/;
// SONAR-EXC: Se omite S5843  porque la expresión valida horas CRON (0–23) con listas, rangos y pasos.
const REGEX_HOUR =
    /^(\*(?:\/(?:1?\d|2[0-3]))?|(?:1?\d|2[0-3])(?:-(?:1?\d|2[0-3]))?(?:\/(?:1?\d|2[0-3]))?)(?:,(\*(?:\/(?:1?\d|2[0-3]))?|(?:1?\d|2[0-3])(?:-(?:1?\d|2[0-3]))?(?:\/(?:1?\d|2[0-3]))?))*$/;
// SONAR-EXC: Se omite S5843 porque esta regex valida días del mes CRON (1–31, *, ?), incluyendo rangos y pasos.
const REGEX_DAY_OF_MONTH =
    /^(\*|\?|[1-9]|[12]\d|3[01])(?:-(?:[1-9]|[12]\d|3[01]))?(?:\/(?:[1-9]|[12]\d|3[01]))?(?:,(?:\*|\?|[1-9]|[12]\d|3[01])(?:-(?:[1-9]|[12]\d|3[01]))?(?:\/(?:[1-9]|[12]\d|3[01]))?)*$/;
// SONAR-EXC: Se omite S5843 porque se requiere una regex que valide meses CRON (1–12) con rangos y pasos.
const REGEX_MONTH =
    /^(\*(?:\/(?:1[0-2]|0?[1-9]))?|(?:1[0-2]|0?[1-9])(?:-(?:1[0-2]|0?[1-9]))?(?:\/(?:1[0-2]|0?[1-9]))?)(?:,(?:\*(?:\/(?:1[0-2]|0?[1-9]))?|(?:1[0-2]|0?[1-9])(?:-(?:1[0-2]|0?[1-9]))?(?:\/(?:1[0-2]|0?[1-9]))?))*$/;
// SONAR-EXC: Se omite S5843 porque esta regex valida días de semana CRON (1–7, *, ?) con rangos y pasos.
const REGEX_DAY_OF_WEEK =
    /^(\*(?:\/(?:[1-7]))?|(?:[1-7])(?:-(?:[1-7]))?(?:\/(?:[1-7]))?|\?)(?:,(?:\*(?:\/(?:[1-7]))?|(?:[1-7])(?:-(?:[1-7]))?(?:\/(?:[1-7]))?|\?))*$/;

const base = {
    description: Joi.string().max(255),
    frequency: Joi.string()
        .max(50)
        .custom((value, helpers) => {
            const parts = value.trim().split(/\s+/);

            if (parts.length !== 5 && parts.length !== 6) {
                return helpers.error('any.invalid');
            }

            const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

            if (
                !REGEX_MINUTE.test(minute) ||
                !REGEX_HOUR.test(hour) ||
                !REGEX_DAY_OF_MONTH.test(dayOfMonth) ||
                !REGEX_MONTH.test(month) ||
                !REGEX_DAY_OF_WEEK.test(dayOfWeek)
            ) {
                return helpers.error('any.invalid');
            }

            return value;
        }),
    start_date: Joi.date(),
    end_date: Joi.date(),
};

export const AutomationSettingsCreateSchema = Joi.object({
    ...base,
    id: Joi.string().uuid().required(),
    created_at: Joi.date().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const AutomationSettingsUpdateSchema = Joi.object({
    ...base,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});

export const AutomationSettingsDeleteSchema = Joi.object({
    ...base,
    deleted_at: Joi.date().allow(null),
    deleted_by: Joi.string().uuid().allow(null),
});
