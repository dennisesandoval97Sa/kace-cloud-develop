import Joi from 'joi';

// Business fields only. The server generates `id` and the audit fields
// (`created_at`, `created_by`) per item via secureObjectCreatePayload, mirroring
// the single-create endpoint. Limits are kept in sync with the comments API
// CommentSchema.mjs.
const itemBase = {
    descripcion: Joi.string().min(3).max(5000).required(),
    calificacion: Joi.number().integer().min(1).max(10).allow(null),
    caso_id: Joi.string().uuid().required(),
};

// The batch runs inside a single transaction, so an unbounded array would hold locks and a
// pool connection for as long as it takes. 500 is the cap already used by cases_bulk.
export const BATCH_MAX_ITEMS = 500;

export const createSchema = Joi.array().items(Joi.object(itemBase)).min(1).max(BATCH_MAX_ITEMS).required();
