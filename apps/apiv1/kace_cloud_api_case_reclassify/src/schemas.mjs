import Joi from 'joi';
import { caseStaleSnapshotFields } from '@kace/api-common';

export const caseReclassifySchema = Joi.object({
    current_clasificacion_id: caseStaleSnapshotFields.current_clasificacion_id,
    clasificacion_id: Joi.string().required().messages({
        'any.required': 'Debe seleccionar los niveles de clasificación',
    }),
    transicion_id: Joi.string().required().messages({ 'any.required': 'Debe seleccionar un estado' }),
    /**
     * Motivo de la reclasificación, obligatorio. El cliente manda solo la descripción: el id, la
     * fecha y el autor los pone el servidor, como en `POST /case-re-open`. Aceptar un id del
     * cliente deja que el llamador escoja a qué fila apunta `cases.cambio_estado_comentario_id`.
     */
    comment: Joi.object({
        descripcion: Joi.string().min(3).max(5000).required(),
    }).required(),
    grupo_id: Joi.string().uuid().allow(''),
    responsable_id: Joi.string().uuid().allow(''),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
