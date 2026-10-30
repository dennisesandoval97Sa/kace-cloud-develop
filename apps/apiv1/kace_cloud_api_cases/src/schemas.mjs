import { ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { ValueObjectUpdateSource } from '@kace/core/src/cases/domain/ValueObjectUpdateSource';
import { caseStaleSnapshotFields } from '@kace/api-common';

import Joi from 'joi';

const schemaBase = {
    cliente_id: Joi.string().uuid(),
    transicion_id: Joi.string().uuid(),
    responsable_id: Joi.string().uuid(),
    clasificacion_id: Joi.string().uuid(),
    descripcion_caso_id: Joi.string().uuid(),
    descripcion_caso: Joi.string().max(5000),
    mail_item_id: Joi.string().allow(null),
    canal_id: Joi.string().allow(null),
    grupo_id: Joi.string().uuid(),
    fecha_resolucion: Joi.date().allow(null),
    motivo_baja: Joi.string().min(3).max(100).allow(null),
    alto_impacto: Joi.number().min(0).max(1),
    vista: Joi.string().allow(null),
    external_code: Joi.string().allow(null),
    parent_id: Joi.string().uuid().allow(null),
};

export const schemaCreate = Joi.object({
    ...schemaBase,
    cliente_id: schemaBase.cliente_id.required(),
    transicion_id: schemaBase.transicion_id.required(),
    responsable_id: schemaBase.responsable_id.required(),
    clasificacion_id: schemaBase.clasificacion_id.required(),
    grupo_id: schemaBase.grupo_id.required(),
    sla_due_date: Joi.date().allow(null),
    id: Joi.string()
        .uuid()
        .default(() => ValueObjectUuid.random()),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
    is_visible: Joi.boolean().default(true),
});

export const schemaUpdate = Joi.object({
    ...schemaBase,
    sla_due_date: Joi.date().allow(null),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
    edited_at: Joi.date().allow(null),
    edited_by: Joi.string().uuid().allow(null),
    is_visible: Joi.boolean().allow(null),
    ...caseStaleSnapshotFields,
});

export const schemaDelete = Joi.object({
    comment: Joi.object({
        id: Joi.string().uuid().required(),
        descripcion: Joi.string().min(3).max(5000).required(),
        calificacion: Joi.number().integer().min(1).max(10).allow(null),
        caso_id: Joi.string().uuid().optional(),
        created_at: Joi.date().timestamp().allow(null),
        created_by: Joi.string().uuid().allow(null),
    }).optional(),
    motivo_baja: Joi.string().required(),
    deleted_at: Joi.date().timestamp().allow(null),
    deleted_by: Joi.string().uuid().allow(null),
});

export const schemaTransitionUpdate = Joi.object({
    transicion_id: Joi.string().uuid().required(),
    update_source: Joi.string()
        .valid(ValueObjectUpdateSource.BULK, ValueObjectUpdateSource.MANUAL)
        .optional()
        .allow(null)
        .default(null),
});

export const auxiliaryCreateSchema = Joi.object({
    id: Joi.string()
        .uuid()
        .default(() => ValueObjectUuid.random()),
    caso_id: Joi.string().uuid().required(),
    data: Joi.object().required(),
    created_at: Joi.date().iso().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const auxiliaryUpdateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    data: Joi.object(),
    updated_at: Joi.date().iso().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});

export const caseWithAuxSchema = Joi.object({
    case: Joi.object().required(),
    aux_cases: Joi.object().required(),
    description: Joi.object(),
    comment: Joi.object({
        descripcion: Joi.string().min(3).max(5000).required(),
    }).optional(),
});

export const createDescriptionSchema = Joi.object({
    id: Joi.string()
        .uuid()
        .default(() => ValueObjectUuid.random()),
    descripcion: Joi.string().required().allow(''),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const updateDescriptionSchema = Joi.object({
    id: Joi.string().uuid().required(),
    descripcion: Joi.string().required(),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});

export const subCaseRelationSchema = Joi.object({
    child_case_id: Joi.string().uuid().required(),
});
