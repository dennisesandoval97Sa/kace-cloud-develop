import Joi from 'joi';
import { ValueObjectUpdateSource } from '@kace/core/src/cases/domain/ValueObjectUpdateSource';

export const caseCloseSchema = Joi.object({
    comment: Joi.object({
        id: Joi.string().uuid().required(),
        descripcion: Joi.string().min(3).max(5000).required(),
        calificacion: Joi.number().integer().min(1).max(10).allow(null),
        caso_id: Joi.string().uuid().optional(),
        created_at: Joi.date().timestamp().allow(null),
        created_by: Joi.string().uuid().allow(null),
    }).optional(),
    motivo_baja: Joi.string().trim().min(3).max(5000).required(),
    updated_at: Joi.date().timestamp().allow(null),
    updated_by: Joi.string().uuid().allow(null),
    closed_at: Joi.date().timestamp().allow(null),
    closed_by: Joi.string().uuid().allow(null),
    update_source: Joi.string()
        .valid(ValueObjectUpdateSource.BULK, ValueObjectUpdateSource.MANUAL)
        .default(ValueObjectUpdateSource.MANUAL),
});
