import Joi from 'joi';
import { ValueObjectUpdateSource } from '@kace/core/src/cases/domain/ValueObjectUpdateSource';
import { RegexPatterns } from '@kace/core/src/shared/domain/regex/RegexPatterns.js';

export const schemaBulkTransitionUpdate = Joi.object({
    case_ids: Joi.array().items(Joi.string().uuid()).min(1).max(500).required(),
    transition_id: Joi.string().uuid().required(),
    update_source: Joi.string()
        .valid(ValueObjectUpdateSource.BULK, ValueObjectUpdateSource.MANUAL)
        .optional()
        .allow(null)
        .default(null),
});

export const schemaBulkClose = Joi.object({
    case_ids: Joi.array().items(Joi.string().uuid()).min(1).max(500).required(),
    close_reason: Joi.string().trim().min(3).max(5000).pattern(RegexPatterns.extendedCharactersRegex()).required(),
});

export const schemaBulkAssign = Joi.object({
    case_ids: Joi.array().items(Joi.string().uuid()).min(1).max(500).required(),
    group_id: Joi.string().uuid().required(),
    responsible_id: Joi.string().uuid().allow(null, '').optional().default(null),
    update_source: Joi.string()
        .valid(ValueObjectUpdateSource.BULK, ValueObjectUpdateSource.MANUAL)
        .optional()
        .allow(null)
        .default(null),
});
