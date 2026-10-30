import Joi from 'joi';
import {
    DATE_FORMATS as VALID_DATE_FORMATS,
    MAX_SEQUENCE_LENGTH,
    MAX_START_VALUE,
    OVERFLOW_POLICIES as VALID_OVERFLOW_POLICIES,
    RESET_POLICIES as VALID_RESET_POLICIES,
    SEGMENT_TYPES as VALID_SEGMENT_TYPES,
} from '@kace/core/src/folio-configurations/domain/segments/segmentCatalog.js';

const segmentSchema = Joi.object({
    type: Joi.string()
        .valid(...VALID_SEGMENT_TYPES)
        .required(),
    // literal
    value: Joi.string().max(50).when('type', { is: 'literal', then: Joi.required(), otherwise: Joi.forbidden() }),

    // date
    format: Joi.string()
        .valid(...VALID_DATE_FORMATS)
        .when('type', { is: 'date', then: Joi.required(), otherwise: Joi.forbidden() }),

    /*
     * field. One dotted path including the entity prefix, exactly the string the
     * action-rules field selector produces:
     *   aux_cases.<form>.<grupo>.<campo> | cases.<col> | clasificaciones.<col>
     */
    path: Joi.string()
        .max(500)
        .pattern(/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)+$/)
        .when('type', { is: 'field', then: Joi.required(), otherwise: Joi.forbidden() }),

    // sequence
    length: Joi.number()
        .integer()
        .min(1)
        .max(MAX_SEQUENCE_LENGTH)
        .when('type', { is: 'sequence', then: Joi.required(), otherwise: Joi.forbidden() }),
    pad_char: Joi.string().length(1).when('type', { is: 'sequence', then: Joi.optional(), otherwise: Joi.forbidden() }),
});

const segmentsSchema = Joi.array()
    .items(segmentSchema)
    .min(1)
    .max(20)
    .custom((segments, helpers) => {
        const sequences = segments.filter((segment) => segment.type === 'sequence');
        if (sequences.length !== 1) {
            return helpers.message(`Debe haber exactamente un segmento de tipo "sequence", hay ${sequences.length}`);
        }
        return segments;
    }, 'exactly-one-sequence');

const schemaBase = {
    nombre: Joi.string().min(3).max(255),
    descripcion: Joi.string().max(500).allow(null, ''),
    segments: segmentsSchema,
    reset_policy: Joi.string().valid(...VALID_RESET_POLICIES),
    start_value: Joi.number().integer().min(0).max(MAX_START_VALUE),
    overflow_policy: Joi.string().valid(...VALID_OVERFLOW_POLICIES),
};

export const schemaCreate = Joi.object({
    ...schemaBase,
    id: Joi.string().uuid().required(),
    nombre: schemaBase.nombre.required(),
    segments: schemaBase.segments.required(),
    status: Joi.number().integer().required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = Joi.object({
    ...schemaBase,
    status: Joi.number().integer(),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});

/** Preview accepts either a saved configuration id or an unsaved draft. */
export const schemaPreview = Joi.object({
    id: Joi.string().uuid(),
    segments: segmentsSchema,
    reset_policy: Joi.string().valid(...VALID_RESET_POLICIES),
    start_value: Joi.number().integer().min(0).max(MAX_START_VALUE),
    overflow_policy: Joi.string().valid(...VALID_OVERFLOW_POLICIES),
    /*
     * Sample values to resolve field segments against, shaped like the case context:
     * { cases: {...}, aux_cases: {...}, clasificaciones: {...} }
     */
    context: Joi.object().default({}),
}).or('id', 'segments');
