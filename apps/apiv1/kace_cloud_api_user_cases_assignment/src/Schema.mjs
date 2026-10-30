import Joi from 'joi';
import { ValueObjectUpdateSource } from '@kace/core/src/cases/domain/ValueObjectUpdateSource';

export const Schema = Joi.object({
    id: Joi.string().required(),
    grupo_id: Joi.string().required(),
    responsable_id: Joi.string().required(),
    update_source: Joi.string()
        .valid(ValueObjectUpdateSource.BULK, ValueObjectUpdateSource.MANUAL)
        .default(ValueObjectUpdateSource.MANUAL),
});
