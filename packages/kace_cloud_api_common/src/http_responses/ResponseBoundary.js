import Joi from 'joi';

const messageSchema = Joi.string().min(1).strict().required();
const statusCodeSchema = Joi.number().integer().min(100).max(599).strict().required();
const recordSchema = Joi.object().unknown(true).strict();
const arraySchema = Joi.array().strict();
const responseDataSchema = Joi.alternatives().try(recordSchema, arraySchema, Joi.valid(null)).optional();
const optionalRecordSchema = Joi.alternatives().try(recordSchema, Joi.valid(null)).optional();
const stringSchema = Joi.string().strict().required();
const allowedOriginsSchema = Joi.string().strict().required();

function parse(schema, value, createError) {
    const result = schema.validate(value);

    if (result.error) {
        throw createError();
    }

    return result.value;
}

export function parseResponseMessage(value) {
    return parse(messageSchema, value, () => new Error('Invalid message'));
}

export function parseResponseStatusCode(value, responseName) {
    return parse(statusCodeSchema, value, () => new Error(`${responseName} - Invalid status code: ${value}`));
}

export function parseResponseHeaders(value, responseName) {
    return parse(optionalRecordSchema, value, () => new Error(`${responseName} - Invalid headers`));
}

export function parseResponseData(value, responseName) {
    return parse(responseDataSchema, value, () => new Error(`${responseName} - Invalid value for "data" ${value}`));
}

export function parseResponseMetadata(value, responseName) {
    return parse(optionalRecordSchema, value, () => new Error(`${responseName} - Invalid metadata`));
}

export function parsePublicData(value, responseName) {
    return parse(optionalRecordSchema, value, () => new Error(`${responseName} - Invalid public data`));
}

export function normalizeResponseValue(value) {
    const stringResult = stringSchema.validate(value);
    if (!stringResult.error) {
        return { kind: 'string', value: stringResult.value };
    }

    const recordResult = recordSchema.validate(value);
    if (!recordResult.error) {
        return { kind: 'record', value: recordResult.value };
    }

    return { kind: 'other', value };
}

export function parseAllowedOrigins(value) {
    const result = allowedOriginsSchema.validate(value);
    if (result.error) {
        return ['*'];
    }

    const allowedOrigins = result.value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    return allowedOrigins.length > 0 ? allowedOrigins : ['*'];
}
