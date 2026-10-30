import Joi from 'joi';
import { Types } from '@kace/core/src/ans/domain/Types.js';

export const createSchema = Joi.object({
    measurementType: Joi.string()
        .valid(...Object.values(Types.toJson()))
        .required(),
});
