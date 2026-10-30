import Joi from "joi";
import { CommentsCreateSchema } from "./CommentSchema";

export const casoCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    cliente_id: Joi.string().required(),
    transicion_id: Joi.string().uuid().required(),
    responsable_id: Joi.string().uuid().required(),
    clasificacion_id: Joi.string().uuid().required(),
    descripcion_caso_id: Joi.string().uuid(),
    descripcion_caso: Joi.string().max(5000),
    mail_item_id: Joi.string(),
    canal_id: Joi.string(),
    grupo_id: Joi.string().uuid().required(),
    fecha_resolucion: Joi.date().allow(null),
    antiguedad: Joi.number().integer().allow(null),
    ans_posicion: Joi.number().integer().allow(null),
    antiguedad_dias: Joi.number().integer().allow(null),
    antiguedad_horas: Joi.number().integer().allow(null),
    antiguedad_minutos: Joi.number().integer().allow(null),
    motivo_baja: Joi.string().min(3).max(100).allow(null),
    alto_impacto: Joi.number().min(1).allow(null),
    vista: Joi.string().allow(null),
    created_at: Joi.date().required(),
    created_by: Joi.string().uuid().required(),
});

export const casoUpdateSchema = Joi.object({
    cliente_id: Joi.string().min(1),
    transicion_id: Joi.string().min(1),
    responsable_id: Joi.string().min(1),
    clasificacion_id: Joi.string().min(1),
    descripcion_caso_id: Joi.string().min(1),
    mail_item_id: Joi.string().min(1),
    canal_id: Joi.string().min(1),
    grupo_id: Joi.string().min(1),
    fecha_resolucion: Joi.date(),
    antiguedad: Joi.number().integer().min(1),
    ans_posicion: Joi.number().integer().min(1),
    antiguedad_dias: Joi.number().integer().min(1),
    antiguedad_horas: Joi.number().integer().min(1),
    antiguedad_minutos: Joi.number().integer().min(1),
    motivo_baja: Joi.string().min(3).max(100),
    alto_impacto: Joi.number().min(1),
    vista: Joi.string().min(1),
    updated_at: Joi.date().required(),
    updated_by: Joi.string().uuid().allow(null),
    deleted_at: Joi.date().allow(null),
    deleted_by: Joi.string().uuid().allow(null),
});

export const caseReclassifySchema = Joi.object({
    clasificacion_id: Joi.string().required().messages({
        "any.required": "Debe seleccionar los niveles de clasificación",
    }),
    transicion_id: Joi.string()
        .required()
        .messages({ "any.required": "Debe seleccionar un estado" }),
    comment: CommentsCreateSchema.keys({
        id: Joi.string().uuid().required(),
        caso_id: Joi.string().uuid().optional(),
        created_at: Joi.date().timestamp().optional(),
        created_by: Joi.string().uuid().optional(),
    }).optional(),
    grupo_id: Joi.string().uuid().allow(""),
    responsable_id: Joi.string().uuid().allow(""),
});

export const caseCloneSchema = Joi.object({
    id: Joi.string().uuid().required(),
    comment: CommentsCreateSchema.keys({
        id: Joi.string().uuid().required(),
        caso_id: Joi.string().uuid().optional(),
        created_at: Joi.date().timestamp().optional(),
        created_by: Joi.string().uuid().optional(),
    }).optional(),
    transicion_id: Joi.string().uuid().allow(""),
    grupo_id: Joi.string().uuid().allow(""),
    responsable_id: Joi.string().uuid().allow(""),
});

export const caseCloseSchema = Joi.object({
    comment: CommentsCreateSchema.keys({
        id: Joi.string().uuid().required(),
        caso_id: Joi.string().uuid().optional(),
        created_at: Joi.date().timestamp().optional(),
        created_by: Joi.string().uuid().optional(),
    }).optional(),
    motivo_baja: Joi.string().required(),
    closed_at: Joi.date().timestamp().allow(null),
    closed_by: Joi.string().uuid().allow(null),
});
export const caseDeleteSchema = Joi.object({
    comment: CommentsCreateSchema.keys({
        id: Joi.string().uuid().required(),
        caso_id: Joi.string().uuid().optional(),
        created_at: Joi.date().timestamp().optional(),
        created_by: Joi.string().uuid().optional(),
    }).optional(),
    motivo_baja: Joi.string().required(),
    deleted_at: Joi.date().timestamp().allow(null),
    deleted_by: Joi.string().uuid().allow(null),
});

export const casoCreateSchemaForm = Joi.object({
    clasificacion_id: Joi.string().required().messages({
        "any.required": "Debe seleccionar los niveles de clasificación",
    }),
    transicion_id: Joi.string()
        .required()
        .messages({ "any.required": "Debe seleccionar un estado" }),
}).messages({ "any.required": "requerido" });

export const casoReOpenSchema = Joi.object({
    comment: CommentsCreateSchema.keys({
        caso_id: Joi.string().uuid().optional(),
    }),
});
export const casoCloneSchema = casoCreateSchema.keys({
    caso_clonado_id: Joi.string().uuid().required(),
    canal_id: Joi.string().allow(null),
    antiguedad: Joi.number().allow(null),
    ans_posicion: Joi.number().allow(null),
    antiguedad_dias: Joi.number().allow(null),
    antiguedad_horas: Joi.number().allow(null),
    antiguedad_minutos: Joi.number().allow(null),
    alto_impacto: Joi.number().allow(null),
    vista: Joi.string().allow(null),
});
export const casoReOpenSchemaForm = Joi.object({
    descripcion: Joi.string().required(),
    transicion_id: Joi.string().uuid().required(),
});
export const casoReassignSchemaForm = Joi.object({
    tipo: Joi.string().required(),
    usuario_id: Joi.string().uuid().when("tipo", {
        is: "2",
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),
    grupo_id: Joi.string().uuid().when("tipo", {
        is: "2",
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),
    grupo: Joi.string().uuid().when("tipo", {
        is: "1",
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),
});
