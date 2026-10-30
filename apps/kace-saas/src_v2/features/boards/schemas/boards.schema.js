import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";
import { SQL } from "@kace_v2/shared/constants/sql.constants";
import { SHARED_VISUAL_ICON_ALLOWLIST } from "@kace/core/src/shared/visual-options/sharedVisualOptions.js";
import { VALID_CONCAT_SEPARATOR_VALUES } from "@kace_v2/features/boards/constants/boards.constants";

const concatSourceSchema = Joi.object({
    entity: Joi.string().required(),
    field: Joi.string().required(),
});

export const validateBoardsSorting = Joi.object({
    entity: JoiHelper.legacyText({ min: 3, max: 255 }).required(),
    field: JoiHelper.legacyText({ min: 3, max: 255 }).required(),
    direction: Joi.string().valid("asc", "desc").required(),
});

export const validateBoardsDetails = Joi.object({
    name: JoiHelper.legacyText({ min: 3, max: 100 }).required(),
    description: JoiHelper.legacyText({ min: 3, max: 100 }).required(),
    primary_entity: JoiHelper.legacyText({ min: 3, max: 100 }).required(),
    page_size: Joi.number().integer().min(10).max(100).default(25).empty(Joi.any().valid("", null)),
    display_order: Joi.number().integer().min(1).max(9999).empty(Joi.any().valid("", null)).optional(),
    onescript_form_id: JoiHelper.uuid().required(),
    filter_onescript_id: JoiHelper.uuid().allow(null, "").optional(),
    is_active: JoiHelper.boolean().optional(),
    can_view_record: JoiHelper.boolean().optional(),
    can_create_record: JoiHelper.boolean().optional(),
    can_edit_record: JoiHelper.boolean().optional(),
    can_admin_bulk_actions: JoiHelper.boolean().optional(),
    can_agent_bulk_actions: JoiHelper.boolean().optional(),
    can_admin_delete_record: JoiHelper.boolean().optional(),
    can_agent_delete_record: JoiHelper.boolean().optional(),
    icon_class: JoiHelper.legacyText({ min: 3, max: 30 })
        .valid(...SHARED_VISUAL_ICON_ALLOWLIST)
        .required(),
    access_groups: Joi.array().allow(null).optional(),
    access_users: Joi.array().allow(null).optional(),
    criteria: Joi.object({
        items: Joi.array().min(1).required(),
    }).required(),
    relations: Joi.array().allow(null).optional(),
    columns: Joi.array().min(1).required(),
    options: Joi.array().allow(null).optional(),
    orders: Joi.array().items(validateBoardsSorting).allow(null).optional(),
    havings: Joi.array().allow(null).optional(),
    quick_ans_filter: Joi.object({
        enabled: JoiHelper.boolean().optional(),
        ans_column_alias: Joi.when("enabled", {
            is: true,
            then: Joi.string().min(1).required(),
            otherwise: Joi.string().allow("").optional(),
        }),
        labels: Joi.object({
            1: Joi.string().allow("").optional(),
            2: Joi.string().allow("").optional(),
            3: Joi.string().allow("").optional(),
        })
            .custom((value, helpers) => {
                const enabled = helpers.state.ancestors?.[0]?.enabled;
                if (!enabled) return value;
                const v1 = (value?.[1] ?? "").trim();
                const v2 = (value?.[2] ?? "").trim();
                const v3 = (value?.[3] ?? "").trim();
                const anyFilled = Boolean(v1) || Boolean(v2) || Boolean(v3);
                const allFilled = Boolean(v1) && Boolean(v2) && Boolean(v3);
                if (anyFilled && !allFilled) {
                    return helpers.error("any.invalid");
                }
                return value;
            }, "quick ans labels all-or-none")
            .messages({ "any.invalid": "quickAnsLabelsAllRequired" })
            .optional(),
        use_default_colors: JoiHelper.boolean().optional(),
        colors: Joi.object({
            1: Joi.string().allow("").optional(),
            2: Joi.string().allow("").optional(),
            3: Joi.string().allow("").optional(),
        }).optional(),
    }).optional(),
});

export const validateBoardsRelations = Joi.object({
    related_entity: Joi.string().min(3).max(100).required(),
    primary_filter: Joi.object().optional(),
    join_type: Joi.string().min(3).max(100).required(),
    on: Joi.array().optional(),
});

export const validateBoardsColumns = Joi.object({
    related_entity: Joi.string().min(3).max(100).required(),
    field: JoiHelper.legacyText({ min: 1, max: 255 }).when("function", {
        is: SQL.CONCAT_FUNCTIONS.CONCAT,
        then: Joi.string().allow("", null).optional(),
        otherwise: Joi.string().required(),
    }),
    alias: JoiHelper.snakeCase({ min: 3, max: 80 }).invalid("id").required().messages({
        "any.invalid": "aliasIdNotAllowed",
    }),
    position: JoiHelper.integer().optional(),
    is_filterable: JoiHelper.boolean().optional(),
    is_ans: JoiHelper.boolean().optional(),
    is_status_column: JoiHelper.boolean().optional(),
    group_by: JoiHelper.boolean().optional(),
    data_type: Joi.string().valid("STRING", "NUMBER", "DATE", "BOOLEAN", "CALCULATED").required(),
    format: JoiHelper.legacyText({ min: 1, max: 255 })
        .allow(null, "")
        .optional()
        .custom((value, helpers) => {
            if (value === "" || value === undefined) {
                return null;
            }
            return value;
        }, "normalize empty to null"),
    function_type: Joi.string()
        .valid("", SQL.FUNCTION_TYPES.AGGREGATE, SQL.FUNCTION_TYPES.COMPARISON, SQL.FUNCTION_TYPES.CONCAT)
        .allow(null, "")
        .when("function", {
            switch: [
                {
                    is: "",
                    then: Joi.optional().allow(null, ""),
                },
                {
                    is: Joi.valid(null),
                    then: Joi.optional().allow(null, ""),
                },
                {
                    is: Joi.valid("sum", "count", "avg", "max", "min", SQL.COMPARISON_FUNCTIONS.DATE_DIFFERENCE),
                    then: Joi.required(),
                },
            ],
            otherwise: Joi.optional().allow(null, ""),
        }),
    function: Joi.string()
        .valid(
            "",
            "sum",
            "count",
            "avg",
            "max",
            "min",
            SQL.COMPARISON_FUNCTIONS.DATE_DIFFERENCE,
            SQL.CONCAT_FUNCTIONS.CONCAT,
        )
        .allow(null, "")
        .optional(),
    concat_sources: Joi.array()
        .items(concatSourceSchema)
        .when("function", {
            is: SQL.CONCAT_FUNCTIONS.CONCAT,
            then: Joi.array().items(concatSourceSchema).min(2).required(),
            otherwise: Joi.array().allow(null).optional(),
        }),
    separator: Joi.string()
        .valid(...VALID_CONCAT_SEPARATOR_VALUES)
        .when("function", {
            is: SQL.CONCAT_FUNCTIONS.CONCAT,
            then: Joi.required(),
            otherwise: Joi.allow(null).optional(),
        }),
    comparison_type: Joi.string()
        .valid(SQL.COMPARISON_TYPES.NOW, SQL.COMPARISON_TYPES.VALUE, SQL.COMPARISON_TYPES.FIELD)
        .when("function", {
            is: SQL.COMPARISON_FUNCTIONS.DATE_DIFFERENCE,
            then: Joi.required(),
            otherwise: Joi.optional().allow(null, ""),
        }),
    comparison_value: Joi.string().when("function", {
        is: SQL.COMPARISON_FUNCTIONS.DATE_DIFFERENCE,
        then: Joi.when("comparison_type", {
            switch: [
                {
                    is: SQL.COMPARISON_TYPES.NOW,
                    then: Joi.string()
                        .valid(SQL.COMPARISON_TYPES.NOW.toUpperCase())
                        .empty(["", null])
                        .default(SQL.COMPARISON_TYPES.NOW.toUpperCase()),
                },
                {
                    is: SQL.COMPARISON_TYPES.VALUE,
                    then: JoiHelper.legacyText({ min: 1, max: 255 }).required(),
                },
            ],
            otherwise: Joi.optional().allow(null, ""),
        }),
        otherwise: Joi.optional().allow(null, ""),
    }),
    comparison_entity: Joi.string()
        .min(3)
        .max(100)
        .when("function", {
            is: SQL.COMPARISON_FUNCTIONS.DATE_DIFFERENCE,
            then: Joi.when("comparison_type", {
                is: SQL.COMPARISON_TYPES.FIELD,
                then: Joi.required(),
                otherwise: Joi.optional().allow(null, ""),
            }),
            otherwise: Joi.optional().allow(null, ""),
        }),
    comparison_field: JoiHelper.legacyText({ min: 1, max: 255 }).when("function", {
        is: SQL.COMPARISON_FUNCTIONS.DATE_DIFFERENCE,
        then: Joi.when("comparison_type", {
            is: Joi.string().valid("FIELD", "field"),
            then: Joi.required(),
            otherwise: Joi.optional().allow(null, ""),
        }),
        otherwise: Joi.optional().allow(null, ""),
    }),
});

export const validateBoardsFunctions = Joi.object({
    related_entity: JoiHelper.legacyText({ min: 3, max: 255 }).required(),
    field: JoiHelper.legacyText({ min: 3, max: 255 }).required(),
    alias: JoiHelper.snakeCase({ min: 3, max: 80 }).invalid("id").required().messages({
        "any.invalid": "aliasIdNotAllowed",
    }),
    function: Joi.string().valid("avg", "count", "max", "min", "sum").required(),
});

export const validateBoardsHaving = Joi.object({
    related_entity: JoiHelper.legacyText({ min: 3, max: 255 }).required(),
    field: JoiHelper.legacyText({ min: 1, max: 255 }).required(),
    function: Joi.string().valid("avg", "count", "max", "min", "sum").required(),
    operator: JoiHelper.legacyText({ min: 1, max: 15 }).required(),
    value: Joi.any().required(),
});

export const validateBoardsOptions = Joi.object({
    type: Joi.string().valid("ACTION", "RESTFLOW", "ONESCRIPT").required(),
    ref_id: JoiHelper.uuid().required(),
    label: JoiHelper.legacyText({ min: 3, max: 120 }).required(),
    requires_confirmation: JoiHelper.boolean().optional(),
});

export const validateBoardsInitialFilter = Joi.object({
    related_entity: JoiHelper.legacyText({ min: 3, max: 255 }).required(),
    field: JoiHelper.legacyText({ min: 1, max: 255 }).required(),
    operator: JoiHelper.legacyText({ min: 1, max: 15 }).required(),
    comparison_type: Joi.string().valid("FIELD", "VALUE", "FUNCIONES").required(),
    field_related_entity: JoiHelper.legacyText({ min: 3, max: 255 }).when("comparison_type", {
        is: "FIELD",
        then: Joi.required(),
        otherwise: Joi.optional().allow(null),
    }),
    function_type: Joi.string()
        .valid(
            "date_calculated_add",
            "date_calculated_substract",
            "logged_in_user",
            "logged_in_user_group",
            "active_client",
        )
        .when("comparison_type", {
            is: "FUNCIONES",
            then: Joi.required(),
            otherwise: Joi.optional().allow(null),
        }),
    days: Joi.string().when("comparison_type", {
        is: "FUNCIONES",
        then: Joi.when("function_type", {
            is: Joi.valid("logged_in_user", "logged_in_user_group", "active_client"),
            then: Joi.optional().allow(null, ""),
            otherwise: Joi.string().when("operator", {
                is: "between",
                then: Joi.string()
                    .custom((value, helpers) => {
                        if (!value || value.trim() === "") {
                            return helpers.error("any.required");
                        }
                        if (!/^\d+,\d+$/.test(value)) {
                            return helpers.error("string.daysBetweenFormat");
                        }
                        const parts = value.split(",");
                        const num1 = parseInt(parts[0], 10);
                        const num2 = parseInt(parts[1], 10);
                        if (isNaN(num1) || isNaN(num2) || num1 < 0 || num2 < 0) {
                            return helpers.error("string.daysBetweenInvalid");
                        }
                        return value;
                    })
                    .required()
                    .messages({
                        "any.required": "required",
                        "string.daysBetweenFormat": "daysBetweenFormat",
                        "string.daysBetweenInvalid": "daysBetweenInvalid",
                    }),
                otherwise: Joi.string()
                    .custom((value, helpers) => {
                        if (!value || value.trim() === "") {
                            return helpers.error("any.required");
                        }
                        if (!/^\d+$/.test(value)) {
                            return helpers.error("string.daysMustBeNumber");
                        }
                        const num = parseInt(value, 10);
                        if (isNaN(num) || num < 0) {
                            return helpers.error("string.daysMustBeNumber");
                        }
                        return value;
                    })
                    .required()
                    .messages({
                        "any.required": "required",
                        "string.daysMustBeNumber": "daysMustBeNumber",
                    }),
            }),
        }),
        otherwise: Joi.optional().allow(null, ""),
    }),
    value: Joi.alternatives().conditional("comparison_type", {
        switch: [
            {
                is: "FUNCIONES",
                then: Joi.when("function_type", {
                    is: Joi.valid("logged_in_user", "logged_in_user_group", "active_client"),
                    then: Joi.optional().allow(null, ""),
                    otherwise: Joi.string().when("operator", {
                        is: "between",
                        then: Joi.string()
                            .pattern(/^\d+,\d+$/)
                            .custom((value, helpers) => {
                                const parts = value.split(",");
                                const num1 = parseInt(parts[0], 10);
                                const num2 = parseInt(parts[1], 10);
                                if (isNaN(num1) || isNaN(num2) || num1 < 0 || num2 < 0) {
                                    return helpers.error("string.daysBetweenInvalid");
                                }
                                return value;
                            })
                            .required()
                            .messages({
                                "string.pattern.base": "daysBetweenFormat",
                                "string.daysBetweenInvalid": "daysBetweenInvalid",
                            }),
                        otherwise: Joi.string()
                            .pattern(/^\d+$/)
                            .custom((value, helpers) => {
                                const num = parseInt(value, 10);
                                if (isNaN(num) || num < 0) {
                                    return helpers.error("string.daysMustBeNumber");
                                }
                                return value;
                            })
                            .required()
                            .messages({
                                "string.pattern.base": "daysMustBeNumber",
                                "string.daysMustBeNumber": "daysMustBeNumber",
                            }),
                    }),
                }),
            },
        ],
        otherwise: Joi.when("operator", {
            is: Joi.valid("in", "notIn"),
            then: JoiHelper.legacyText({ min: 1, max: 255 }).required(),
            otherwise: Joi.alternatives().try(
                Joi.number(),
                JoiHelper.legacyText({ min: 1, max: 255 }).required(),
                Joi.boolean(),
            ),
        }),
    }),
    type: Joi.string().valid("and", "or").required(),
});
