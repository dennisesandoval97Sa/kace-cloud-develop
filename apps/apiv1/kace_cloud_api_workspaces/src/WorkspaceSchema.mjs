import Joi from 'joi';
import { WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED } from '@kace/error-codes';

const RULE_VALUE_MIN_LENGTH = 4;
const RULE_VALUE_MAX_LENGTH = 50;

/*
 * Channel Hub receives each value trimmed, so the length is checked without the surrounding
 * whitespace while the value is stored as sent.
 */
const ruleValue = Joi.string().custom((value, helpers) => {
    const { length } = value.trim();
    if (length < RULE_VALUE_MIN_LENGTH) return helpers.error('string.min', { limit: RULE_VALUE_MIN_LENGTH });
    if (length > RULE_VALUE_MAX_LENGTH) return helpers.error('string.max', { limit: RULE_VALUE_MAX_LENGTH });
    return value;
});
const ruleTextArray = Joi.array().items(ruleValue);
/*
 * The values of legacy array rules never reach Channel Hub (registering them is rejected and
 * updates only read the structured keys), so they keep their original contract and a persisted
 * snapshot can be sent back as is.
 */
const legacyRules = Joi.array().items(Joi.object());
const tagRestFlowId = Joi.string().uuid().allow(null).empty('');
const channelHubAccount = Joi.object({
    id: Joi.string().uuid().required(),
}).unknown(true);
const channelHubAccounts = Joi.array().items(channelHubAccount).min(1).messages({
    'any.required': 'channel_hub_accounts is required',
    'array.base': 'channel_hub_accounts must be an array',
    'array.min': 'channel_hub_accounts must contain at least one Channel Hub Account',
});

const workspaceRoutingRules = Joi.object({
    ruleId: Joi.string().allow('', null),
    ruleName: Joi.string().max(50).allow('', null),
    subjectContains: ruleTextArray,
    subjectEquals: ruleTextArray,
    ccContains: ruleTextArray,
    ccEquals: ruleTextArray,
    fromContains: ruleTextArray,
    fromEquals: ruleTextArray,
    toContains: ruleTextArray,
    toEquals: ruleTextArray,
    bodyContains: ruleTextArray,
    bodyEquals: ruleTextArray,
    actionRules: Joi.object({
        classifyAs: Joi.string().max(50).allow('', null),
    }).unknown(false),
})
    .or(
        'ruleName',
        'ruleId',
        'subjectContains',
        'subjectEquals',
        'ccContains',
        'ccEquals',
        'fromContains',
        'fromEquals',
        'toContains',
        'toEquals',
        'bodyContains',
        'bodyEquals',
        'actionRules'
    )
    .unknown(false);

const base = {
    id: Joi.string().uuid(),
    description: Joi.string().max(500).min(1).allow(null),
    is_active: Joi.boolean(),
    tag: Joi.string().max(50).min(1).allow(null),
    rules: Joi.alternatives().try(legacyRules, workspaceRoutingRules).allow(null),
    mails_accounts: Joi.array().items(Joi.object()).allow(null),
    channel_hub_accounts: channelHubAccounts,
    groups: Joi.array().items(Joi.object()).allow(null),
    tag_creation_flow_id: tagRestFlowId,
    tag_update_flow_id: tagRestFlowId,
    tag_deletion_flow_id: tagRestFlowId,
    created_by: Joi.string().uuid(),
    updated_by: Joi.string().uuid(),
    updated_at: Joi.date(),
};
export const WorkspaceCreateSchema = Joi.object({
    id: base.id.required(),
    description: base.description,
    is_active: base.is_active,
    tag: base.tag,
    rules: base.rules,
    mails_accounts: base.mails_accounts,
    channel_hub_accounts: base.channel_hub_accounts.required(),
    groups: base.groups,
    tag_creation_flow_id: base.tag_creation_flow_id,
    tag_update_flow_id: base.tag_update_flow_id,
    tag_deletion_flow_id: base.tag_deletion_flow_id,
    created_by: Joi.string().uuid(),
    created_at: Joi.date(),
});

export const WorkspaceDeactivateSchema = Joi.object({
    description: base.description,
    is_active: base.is_active.valid(false).default(false),
    tag: base.tag,
    rules: base.rules,
    mails_accounts: base.mails_accounts,
    channel_hub_accounts: base.channel_hub_accounts,
    groups: base.groups,
    tag_creation_flow_id: base.tag_creation_flow_id,
    tag_update_flow_id: base.tag_update_flow_id,
    tag_deletion_flow_id: base.tag_deletion_flow_id,
    updated_by: base.updated_by,
    updated_at: base.updated_at,
});

export const WorkspaceUpdateSchema = WorkspaceDeactivateSchema.keys({
    updated_by: base.updated_by.required(),
    updated_at: base.updated_at.required(),
    is_active: base.is_active.invalid(false).messages({
        'any.invalid': 'Use POST /workspaces/:id/deactivate to deactivate a workspace',
    }),
});

export function publicErrorCodeForWorkspaceValidation(error) {
    const hasChannelHubAccountError = error?.details?.some((detail) => detail.path?.[0] === 'channel_hub_accounts');

    return hasChannelHubAccountError ? WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED : undefined;
}
