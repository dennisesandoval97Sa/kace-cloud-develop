import Joi from 'joi';
import { Types } from '@kace/core/src/action-update-model/domain/Types';
import { Aggregates } from '@kace/core/src/action-update-model/domain/Aggregates';
import { Formulas } from '@kace/core/src/action-update-model/domain/Formulas';

const schemaBase = {
    description: Joi.string().max(255),
    aggregate: Joi.string().valid(...Object.values(Aggregates.toJson())),
    field: Joi.string().max(100),
    type: Joi.string().valid(...Object.values(Types.toJson())),
    formula: Joi.when('type', {
        is: Types.FORMULA.value,
        then: Joi.string()
            .valid(...Object.values(Formulas.toJson()))
            .required(),
        otherwise: Joi.optional().allow(null, ''),
    }),
    value: Joi.string()
        .max(100)
        .when('type', {
            is: Joi.exist(),
            then: Joi.when('type', {
                is: Joi.not(Types.FORMULA.value),
                then: Joi.required(),
                otherwise: Joi.when('formula', {
                    is: Formulas.MODELO_A_MODELO.value,
                    then: Joi.required(),
                    otherwise: Joi.optional().allow(null),
                }),
            }),
            otherwise: Joi.optional(),
        }),
};

export const schemaCreate = Joi.object({
    ...schemaBase,
    id: Joi.string().uuid().required(),
    description: schemaBase.description.required(),
    aggregate: schemaBase.aggregate.required(),
    field: schemaBase.field.required(),
    type: schemaBase.type.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = Joi.object({
    ...schemaBase,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
