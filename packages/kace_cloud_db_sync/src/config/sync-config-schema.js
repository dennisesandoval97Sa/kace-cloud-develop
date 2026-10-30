import Joi from 'joi';
import { IDENTIFIER_PATTERN } from '../shared/identifier.js';

const identifier = Joi.string().pattern(IDENTIFIER_PATTERN);

const endpointSchema = Joi.object({
    database: identifier.required(),
    schema: identifier.required(),
});

const tableSchema = Joi.object({
    name: identifier.required(),
    targetName: identifier.optional(),
    where: Joi.string().min(1).optional(),
});

const syncConfigSchema = Joi.object({
    source: endpointSchema.required(),
    target: endpointSchema.required(),
    batchSize: Joi.number().integer().min(1).max(10000).default(500),
    tables: Joi.array().items(tableSchema).min(1).required(),
}).required();

/**
 * Validates the raw sync configuration file contents.
 *
 * @param {Object} raw - Parsed JSON configuration.
 * @returns {Object} The validated configuration with defaults applied.
 * @throws {Error} When the configuration does not match the schema.
 */
export const validateSyncConfig = (raw) => {
    const { value, error } = syncConfigSchema.validate(raw, { abortEarly: false, convert: true });

    if (error) {
        throw new Error(`Invalid sync config: ${error.message}`);
    }

    return value;
};
