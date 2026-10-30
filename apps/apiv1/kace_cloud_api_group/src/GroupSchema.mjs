import Joi from 'joi';

const base = {
    id: Joi.string().uuid(),
    nombre: Joi.string().max(100).min(1),
    horario_id: Joi.string().uuid(),
    rol_id: Joi.string().uuid().allow(null),
    descripcion: Joi.string().max(500).min(1).allow(null),
    codigo_externo: Joi.string().max(20).min(1).allow(null),
    codigos_externos: Joi.object().allow(null),
    permisos: Joi.object().allow(null),
    layouts: Joi.object().allow(null),
    configuration_id: Joi.string().uuid().allow(null),
    comportamientos: Joi.object().allow(null),
    filter_order: Joi.string().allow(null),
    data: Joi.object(),
    ips_allowed: Joi.object(),
    status: Joi.number().integer(),
    created_by: Joi.string().uuid(),
    updated_by: Joi.string().uuid(),
    updated_at: Joi.date(),
};
export const GroupCreateSchema = Joi.object({
    id: base.id.required(),
    nombre: base.nombre.required(),
    horario_id: base.horario_id.required(),
    rol_id: base.rol_id,
    configuration_id: base.configuration_id,
    descripcion: base.descripcion,
    codigo_externo: base.codigo_externo,
    codigos_externos: base.codigos_externos,
    permisos: base.permisos,
    layouts: base.layouts,
    comportamientos: base.comportamientos,
    filter_order: base.filter_order,
    status: base.status,
    data: Joi.object(),
    ips_allowed: Joi.object(),
    user_ids: Joi.array().items(Joi.string().uuid()),
    created_by: Joi.string().uuid(),
    created_at: Joi.date(),
});

export const GroupUpdateSchema = Joi.object({
    ...base,
    // GET /groups/{id} returns null for a deleted schedule; resending it gets GROUP_SCHEDULE_UNAVAILABLE.
    horario_id: base.horario_id.allow(null),
});

export const GroupSchemaForm = Joi.object({
    ...base,
    nombre: base.nombre.required(),
    descripcion: base.descripcion.required(),
    horario_id: base.horario_id.required(),
    codigo_externo: base.codigo_externo.required(),
    updated_by: Joi.string().uuid(),
    updated_at: Joi.date(),
});
export const AssignCasesGroup = Joi.object({
    cases: Joi.array().required(),
});
