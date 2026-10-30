import Joi from 'joi';

export const caseStaleSnapshotFields = {
    current_transicion_id: Joi.string().uuid().allow(null).optional(),
    current_responsable_id: Joi.string().uuid().allow(null).optional(),
    current_cliente_id: Joi.string().uuid().allow(null).optional(),
    current_clasificacion_id: Joi.string().uuid().allow(null).optional(),
    current_grupo_id: Joi.string().uuid().allow(null).optional(),
};
