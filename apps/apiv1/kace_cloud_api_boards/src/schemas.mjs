import Joi from 'joi';
import { SHARED_VISUAL_ICON_ALLOWLIST } from '@kace/core/src/shared/visual-options/sharedVisualOptions.js';
import {
    QUICK_ANS_FILTER_DEFAULT_VALUE,
    QUICK_ANS_FILTER_HEX_COLOR_REGEX,
    QUICK_ANS_FILTER_LABEL_MAX_LENGTH,
} from '@kace/core/src/boards/domain/QuickAnsFilterDefaults.js';

const allowlistedBoardIcon = Joi.string()
    .valid(...SHARED_VISUAL_ICON_ALLOWLIST)
    .messages({ 'any.only': '"icon_class" must be an approved visual icon' });

const validOperators = [
    'eq',
    'neq',
    'gt',
    'lt',
    'gte',
    'lte',
    'in',
    'nin',
    'between',
    'notIn',
    'like',
    'ilike',
    'null',
    'notNull',
    'jsonContains',
    'jsonArrayValue',
];

const validAggregateFunctions = ['count', 'sum', 'avg', 'min', 'max'];
const validComparisonFunctions = ['date_difference'];
const validConcatFunctions = ['concat'];
const validConcatSeparators = [' ', ', ', ' - ', ' | ', ' / ', ''];

const concatSourceSchema = Joi.object({
    entity: Joi.string().required(),
    field: Joi.string().required(),
});

const validCriteriaFunctions = [
    'date_calculated_add',
    'date_calculated_substract',
    'logged_in_user',
    'logged_in_user_group',
    'active_client',
];

const logicalType = Joi.string().valid('and', 'or').required();

const operatorSchema = Joi.string()
    .valid(...validOperators)
    .default('eq');

const valueSchema = Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean());

const criteriaItemSchema = Joi.object({
    entity: Joi.string().required(),
    field: Joi.string().required(),
    operator: operatorSchema,
    value: valueSchema.allow('null').allow('').required(),
    type: logicalType,
    function_type: Joi.string()
        .valid(...validCriteriaFunctions)
        .optional(),
});

const criteriaSchema = Joi.object({
    items: Joi.array().items(criteriaItemSchema).min(1).required(),
});

const relationOnSchema = Joi.object({
    left: Joi.string().required(),
    right: Joi.string().required(),
    operator: operatorSchema,
    type: logicalType,
});

const relationSchema = Joi.object({
    primary_entity: Joi.string().required(),
    related_entity: Joi.string().required(),
    alias: Joi.string().required(),
    join_type: Joi.string().valid('left', 'join', 'right').insensitive().required(),
    on: Joi.array().items(relationOnSchema).min(1).required(),
    relations: Joi.array().items(Joi.link('#relation')).default([]),
}).id('relation');

const columnSchema = Joi.object({
    entity: Joi.string().when('function', {
        is: 'concat',
        then: Joi.string().allow('', null).optional(),
        otherwise: Joi.string().required(),
    }),
    field: Joi.string().when('function', {
        is: 'concat',
        then: Joi.string().allow('', null).optional(),
        otherwise: Joi.string().required(),
    }),
    alias: Joi.string().max(80).required(),
    position: Joi.number().integer().min(0).required(),
    is_filterable: Joi.boolean().default(false),
    is_ans: Joi.boolean().default(false),
    visible: Joi.boolean().default(true),
    data_type: Joi.string().valid('STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'CALCULATED').insensitive().required(),
    format: Joi.string().allow(null),
    function: Joi.string()
        .valid(...validAggregateFunctions, ...validComparisonFunctions, ...validConcatFunctions)
        .allow(null),
    group_by: Joi.boolean().default(false),
    comparison_entity: Joi.string().allow(null),
    comparison_field: Joi.string().allow(null),
    comparison_type: Joi.string().allow(null),
    function_type: Joi.string().allow(null),
    comparison_value: Joi.string().allow(null),
    is_status_column: Joi.boolean().optional(),
    concat_sources: Joi.array()
        .items(concatSourceSchema)
        .when('function', {
            is: 'concat',
            then: Joi.array().items(concatSourceSchema).min(2).required(),
            otherwise: Joi.array().allow(null).optional(),
        }),
    separator: Joi.string()
        .valid(...validConcatSeparators)
        .when('function', {
            is: 'concat',
            then: Joi.required(),
            otherwise: Joi.allow(null).optional(),
        }),
});

const havingsSchema = Joi.object({
    entity: Joi.string().required(),
    field: Joi.string().required(),
    function: Joi.string()
        .valid(...validAggregateFunctions)
        .required(),
    operator: operatorSchema.required(),
    value: Joi.number().required(),
    type: Joi.string().valid('having').required(),
});

const accessGroupSchema = Joi.string().uuid().required();

const optionSchema = Joi.object({
    id: Joi.string().uuid().required(),
    type: Joi.string().valid('ACTION', 'RESTFLOW', 'ONESCRIPT').required(),
    ref_id: Joi.string().uuid().required(),
    label: Joi.string().max(120).required(),
    requires_confirmation: Joi.boolean().default(false),
});

const orderBySchema = Joi.object({
    direction: Joi.string().valid('asc', 'desc').required(),
    entity: Joi.string().required(),
    field: Joi.string().required(),
});

const quickAnsLabelMap = Joi.object({
    1: Joi.string().allow('').max(QUICK_ANS_FILTER_LABEL_MAX_LENGTH).optional(),
    2: Joi.string().allow('').max(QUICK_ANS_FILTER_LABEL_MAX_LENGTH).optional(),
    3: Joi.string().allow('').max(QUICK_ANS_FILTER_LABEL_MAX_LENGTH).optional(),
});

const quickAnsColorMap = Joi.object({
    1: Joi.string().allow('').pattern(QUICK_ANS_FILTER_HEX_COLOR_REGEX).optional(),
    2: Joi.string().allow('').pattern(QUICK_ANS_FILTER_HEX_COLOR_REGEX).optional(),
    3: Joi.string().allow('').pattern(QUICK_ANS_FILTER_HEX_COLOR_REGEX).optional(),
});

const quickAnsFilterSchema = Joi.object({
    enabled: Joi.boolean().default(false),
    ans_column_alias: Joi.string()
        .allow('', null)
        .max(80)
        .when('enabled', { is: true, then: Joi.string().min(1).required() }),
    labels: quickAnsLabelMap.default({}),
    use_default_colors: Joi.boolean().default(true),
    colors: quickAnsColorMap.default({}),
})
    .optional()
    .allow(null)
    .default(() => structuredClone(QUICK_ANS_FILTER_DEFAULT_VALUE))
    .custom((value, helpers) => {
        if (!value?.enabled) return value;

        const labels = value.labels ?? {};
        const filled = [1, 2, 3].map((k) => (labels[k] ?? '').trim()).filter(Boolean);
        if (filled.length > 0 && filled.length < 3) {
            return helpers.error('any.invalid', { message: 'quickAnsLabelsAllRequired' });
        }

        const board = helpers.state.ancestors?.find?.((a) => Array.isArray(a?.columns));
        const columns = board?.columns ?? [];
        const matched = columns.find((c) => c?.alias === value.ans_column_alias);
        if (!matched) {
            return helpers.error('any.invalid', { message: 'quickAnsAliasNotInColumns' });
        }
        if (!matched.is_ans) {
            return helpers.error('any.invalid', { message: 'quickAnsAliasNotIsAns' });
        }

        return value;
    }, 'quick_ans_filter coherence');

const base = {
    id: Joi.string().uuid(),
    name: Joi.string().trim().min(1).required(),
    description: Joi.string().allow('', null),
    primary_entity: Joi.string().required(),
    criteria: criteriaSchema.required(),
    page_size: Joi.number().integer().min(10).max(100).default(25),
    display_order: Joi.number().integer().min(1).max(9999).allow(null).optional(),
    is_active: Joi.boolean().default(true),
    can_view_record: Joi.boolean().default(true),
    can_create_record: Joi.boolean().default(true),
    can_edit_record: Joi.boolean().default(true),
    can_admin_bulk_actions: Joi.boolean().default(false),
    can_agent_bulk_actions: Joi.boolean().default(false),
    can_admin_delete_record: Joi.boolean().default(false),
    can_agent_delete_record: Joi.boolean().default(false),
    icon_class: allowlistedBoardIcon.allow(null),
    onescript_form_id: Joi.string().allow('', null),
    filter_onescript_id: Joi.string().allow('', null),
    access_groups: Joi.array().items(accessGroupSchema).default([]),
    access_users: Joi.array().items(accessGroupSchema).default([]),
    relations: Joi.array().items(relationSchema).default([]),
    columns: Joi.array().items(columnSchema).default([]),
    havings: Joi.array().items(havingsSchema).default([]),
    options: Joi.array().items(optionSchema).default([]),
    orders: Joi.array().items(orderBySchema).optional().allow(null),
    quick_ans_filter: quickAnsFilterSchema,
};

export const boardCreate = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    created_at: Joi.date().timestamp().optional(),
    created_by: Joi.string().uuid().optional(),
});

export const boardUpdate = Joi.object({
    ...base,
});

export const boardDelete = Joi.object({
    ...base,
    deleted_at: Joi.date().timestamp().optional(),
    deleted_by: Joi.string().uuid().optional(),
});
