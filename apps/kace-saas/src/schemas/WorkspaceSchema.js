import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const RULE_VALUE_MIN_LENGTH = 4;
const RULE_VALUE_MAX_LENGTH = 50;

// Mirrors the backend: Channel Hub receives values trimmed, so the trimmed length is checked.
const ruleValue = Joi.string().custom((value, helpers) => {
    const { length } = value.trim();
    if (length < RULE_VALUE_MIN_LENGTH) return helpers.error("string.min", { limit: RULE_VALUE_MIN_LENGTH });
    if (length > RULE_VALUE_MAX_LENGTH) return helpers.error("string.max", { limit: RULE_VALUE_MAX_LENGTH });
    return value;
});

// A fully empty row is dropped on submit; any other row must be complete.
const emptyCell = Joi.valid("", null);
const emptyRule = Joi.object({ field: emptyCell, operator: emptyCell, value: emptyCell }).unknown(true);
const ruleRow = Joi.object()
    .when(emptyRule, {
        otherwise: Joi.object({
            field: Joi.string().required(),
            operator: Joi.string().required(),
            value: ruleValue.required(),
        }),
    })
    .unknown(true);
const ruleRows = Joi.array().items(ruleRow).allow(null);

// Unchanged rules are not sent on deactivation, so they are not validated (context set by the form).
const tableRules = Joi.when("$keepPersistedRules", {
    is: true,
    then: Joi.array().items(Joi.object()).allow(null),
    otherwise: ruleRows,
});

export const WorkspaceSchemaForm = Joi.object({
    id: JoiHelper.uuid().allow(""),
    description: JoiHelper.description({ min: 3, max: 100 }).required().allow(null),
    tag: JoiHelper.generalText({ min: 4, max: 100 }).required(),
    is_active: JoiHelper.boolean().required(),
    rules: Joi.any().allow(null),
    tableRules,
    mails_accounts: Joi.array().items(Joi.any()).allow(null),
    channel_hub_accounts: Joi.array().items(Joi.any()).min(1).required().messages({
        "any.required": "workspaceChannelHubAccountsRequired",
        "array.base": "workspaceChannelHubAccountsRequired",
        "array.min": "workspaceChannelHubAccountsRequired",
    }),
    groups: Joi.array().items(Joi.any()).allow(null),
    tag_creation_flow_id: JoiHelper.uuid().allow("", null),
    tag_update_flow_id: JoiHelper.uuid().allow("", null),
    tag_deletion_flow_id: JoiHelper.uuid().allow("", null),
    created_at: Joi.any().allow("", null),
    created_by: Joi.any().allow("", null),
    updated_at: Joi.any().allow("", null),
    deleted_at: Joi.any().allow("", null),
    deleted_by: Joi.any().allow("", null),
}).strict();
