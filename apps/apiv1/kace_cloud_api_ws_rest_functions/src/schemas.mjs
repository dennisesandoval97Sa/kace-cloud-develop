import Joi from 'joi';

const requiredTextTypes = ['maskText', 'concatenate', 'concatenateComma', 'regexOr'];
const requiredNumberTypes = ['increment', 'divide', 'subtract', 'add'];
const requiredDateTypes = ['addMinutes', 'addHours', 'addDays', 'subtractMinutes', 'subtractHours', 'subtractDays'];

const baseFields = {
    id: Joi.string().uuid().required(),
    description: Joi.string().max(255).required(),
    type: Joi.string().max(255).required(),
    filter_input: Joi.object().required(),
    context_position: Joi.string().allow(null, ''),
    value_dynamic: Joi.boolean().required(),
    value_static: Joi.when('type', {
        is: Joi.valid(...requiredTextTypes),
        then: Joi.string().required(),
        otherwise: Joi.when('type', {
            is: Joi.valid(...requiredNumberTypes),
            then: Joi.when('value_dynamic', {
                is: true,
                then: Joi.string().required(),
                otherwise: Joi.number().required(),
            }),
            otherwise: Joi.when('type', {
                is: Joi.valid(...requiredDateTypes),
                then: Joi.when('value_dynamic', {
                    is: true,
                    then: Joi.string().required(),
                    otherwise: Joi.string()
                        .pattern(/^\d+(\.\d+)?(,[A-Za-z]+\/[A-Za-z_]+)?$/)
                        .required(),
                }),
                otherwise: Joi.any().optional(),
            }),
        }),
    }),
    is_active: Joi.boolean().required(),
    created_by: Joi.string().uuid().required(),
    updated_by: Joi.string().uuid().allow(null),
    deleted_by: Joi.string().uuid().allow(null),
    created_at: Joi.date().iso(),
    updated_at: Joi.date().iso().allow(null),
    deleted_at: Joi.date().iso().allow(null),
    initial_context: Joi.object().optional(),
};
const schemaBase = Joi.object(baseFields);
export const createSchemaForm = schemaBase;
export const createSchema = Joi.object({
    ...baseFields,
    id: Joi.string().uuid(),
});
export const updateSchema = Joi.object({
    ...baseFields,
    created_by: Joi.string().uuid().allow(null),
});
