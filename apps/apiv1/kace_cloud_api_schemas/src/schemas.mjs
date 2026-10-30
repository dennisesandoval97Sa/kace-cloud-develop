import Joi from 'joi';

export const VALID_INPUT_TYPES = [
    'text',
    'textarea',
    'select',
    'radio',
    'checkbox',
    'date',
    'datetime',
    'number',
    'currency',
    'email',
    'submit',
    'password',
];

const uiSchema = Joi.object({
    label: Joi.string().max(100).allow('').default(''),
    css: Joi.string().max(100).allow('').default(''),
    input_type: Joi.string()
        .valid(...VALID_INPUT_TYPES)
        .default('text'),
    show_in_grid: Joi.boolean().default(false),
    read_only: Joi.boolean().default(false),
    is_visible: Joi.boolean().default(true),
    ui_modified: Joi.boolean().default(false),
}).default();

const sourcesSchema = Joi.object({
    literals_source: Joi.string().uri().optional(),
    auxiliaries_source: Joi.string().uri().optional(),
    entities_source: Joi.string().uri().optional(),
    restflow_source: Joi.string().uri().optional(),
}).default({});

const calcSchema = Joi.object({
    formula: Joi.string().required(),
    on: Joi.array().items(Joi.string().valid('create', 'update')).default(['create']),
    error_policy: Joi.string().valid('error', 'empty').default('error'),
}).optional();

const numericTypes = Joi.valid('string', 'number', 'array');

const dateOrNowSchema = Joi.alternatives().try(Joi.string().isoDate(), Joi.string().valid('now'));

const fieldSchema = Joi.object({
    type: Joi.string().valid('string', 'number', 'boolean', 'date', 'calculated', 'object', 'array').required(),
    required: Joi.boolean().required(),
    min: Joi.alternatives().conditional('type', {
        switch: [
            { is: numericTypes, then: Joi.number() },
            { is: 'date', then: dateOrNowSchema },
        ],
        otherwise: Joi.forbidden(),
    }),
    max: Joi.alternatives().conditional('type', {
        switch: [
            { is: numericTypes, then: Joi.number() },
            { is: 'date', then: Joi.string().isoDate() },
        ],
        otherwise: Joi.forbidden(),
    }),

    ui: uiSchema.optional(),
    sources: sourcesSchema.optional(),
    dependency: Joi.boolean().default(false),
    dependencyValueValidation: Joi.boolean()
        .default(false)
        .when('dependency', {
            is: false,
            then: Joi.boolean().valid(false),
        }),
    dependencyValue: Joi.string()
        .allow(null, '')
        .when('dependencyValueValidation', {
            is: true,
            then: Joi.string().required().min(1),
            otherwise: Joi.string().allow(null, ''),
        }),
    dependsOn: Joi.string()
        .allow(null, '')
        .when('dependency', {
            is: true,
            then: Joi.string().required(),
            otherwise: Joi.string().allow(null, ''),
        }),
    calc: Joi.when('type', {
        is: 'calculated',
        then: calcSchema.required(),
        otherwise: calcSchema.forbidden(),
    }),
}).unknown(true);

const base = {
    id: Joi.string().uuid(),
    name: Joi.string().min(1).max(45),
    data_structure: Joi.object().pattern(Joi.string(), fieldSchema).min(1).required(),
    is_active: Joi.boolean(),
};

export const schemaCreate = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    created_at: Joi.date().timestamp().optional(),
    created_by: Joi.string().uuid().optional(),
});

export const schemaUpdate = Joi.object({
    ...base,
    updated_at: Joi.date().optional(),
    updated_by: Joi.string().uuid().optional(),
});

export const schemaDelete = Joi.object({
    ...base,
    deleted_at: Joi.date().timestamp().optional(),
    deleted_by: Joi.string().uuid().optional(),
});
