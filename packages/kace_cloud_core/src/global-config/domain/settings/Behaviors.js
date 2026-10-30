import { ValidationFailError } from '../../../shared/errors/ValidationFailError';
import { ConfigurationAggregate } from './ConfigurationAggregate';
import { Helper } from '../../../shared/index.js';
import { ACTIVE_SESSION_LIMIT_RANGE, REPORT_FILTER_DAYS_RANGE } from './behaviorNumericRanges.js';

const REOPEN_WINDOW_MAX_DAYS = 36500;
const REOPEN_WINDOW_PATH = 'settings.behaviors.application.agente.casos.reopen_cases_only_last_days';
const REOPEN_WINDOW_INVALID_MESSAGE =
    'Invalid reopen window days value, the value must be a whole number greater than or equal to 0';

export class Behaviors extends ConfigurationAggregate {
    static #EXPECTED_STRUCTURE = {
        application: {
            admin: {
                menus: {
                    hidden_menus: [],
                },
                users: {
                    inactivity_time: 120,
                    oneScript_users: '',
                    users_schema_id: '',
                    warning_logout_time: 5,
                    active_session_limit: 2,
                    group_membership_check_interval: 0,
                },
                groups: {
                    groups_schema_id: '',
                    oneScript_groups: '',
                },
                reports: {
                    report_filter_days: 1,
                },
            },
            agente: {
                casos: {
                    order_type: '',
                    folio_length: 0,
                    assign_strategy: '',
                    work_queue_sorting_rules: [],
                    assignLastResponsibleIgnoreDefault: false,
                    type_assignment: '',
                    max_cases_per_user: 0,
                    case_enable_subcases: true,
                    semaphore_by_state_ans: false,
                    activeUsers_filter_bool: true,
                    activeUsers_filter_integration_bool: false,
                    assignment_active_session_limit: 2,
                    case_require_state_change: false,
                    reassignFilterActiveUsers: false,
                    reassignIncludeDefaultAssignees: false,
                    add_folio_to_external_code: false,
                    agent_filter_subcases_only: false,
                    close_tab_on_case_created: false,
                    return_to_board_on_case_saved: false,
                    allow_new_one_script_forms: true,
                    cases_one_script_base_form: '',
                    account_to_send_notifications: null,
                    allow_close_case_without_subcases: true,
                    due_date_for_ans_calculation: false,
                    ans_display_mode: 'row',
                    allow_description_empty: null,
                    lock_case_description_edit: false,
                    allow_case_reclassification: false,
                    cast_type: null,
                    advanced_cases_search: null,
                    advanced_cases_search_one_script_form: null,
                    enableAdminApplication: false,
                    case_stale_check: null,
                    transition_stale_check: false,
                    responsable_stale_check: false,
                    reopen_cases_only_last_days: 7,
                    async_case_post_processing: false,
                },
                geolocation: {
                    geolocation_login_bool: false,
                    geolocation_case_creation_bool: false,
                    geolocation_client_search_bool: false,
                    geolocation_client_creation_bool: false,
                    geolocation_client_update_bool: false,
                    geolocation_case_update_bool: null,
                    geolocation_logout_bool: null,
                    geolocation_current_location_bool: null,
                    max_map_markers: null,
                },
                files_extensions: {
                    maximun_size_allowed: 0,
                    quantity_files_allowed: 0,
                    allowed_file_extensions: [],
                },
                channel_hub: {
                    create_rules_channel_hub_flow_id: '',
                    account_channel_hub_flow_id: '',
                    send_email_channel_hub_flow_id: '',
                    reply_email_channel_hub_flow_id: '',
                },
                onescript: {
                    onescript_cache_ttl_ms: 0,
                },
                validation_rules: {
                    clients: {
                        required_fields: {
                            required_sexo: false,
                            required_email: true,
                            required_nombres: false,
                            required_telefono: false,
                            required_apellido1: false,
                            required_apellido2: false,
                            required_estado_civil: false,
                            required_email_alterno: false,
                            required_nombre_empresa: false,
                            required_fecha_nacimiento: false,
                            required_telefono_alterno: false,
                        },
                    },
                },
            },
        },
    };

    /**
     * Single source of truth for the numeric behaviour settings that must be
     * validated on both the constructor and the merge (partial update) path.
     * `min` defaults to 0; `max` and `default` are optional (`default` falls
     * back to `min` when omitted, and is used to normalize legacy values on the
     * non-strict hydration path).
     */
    static #NUMERIC_RULES = [
        {
            path: 'application.agente.onescript.onescript_cache_ttl_ms',
            label: 'OneScript cache TTL',
            unit: 'milliseconds',
            default: 0,
        },
        {
            path: 'application.agente.casos.assignment_active_session_limit',
            label: 'assignment active session limit',
            unit: 'minutes',
            min: ACTIVE_SESSION_LIMIT_RANGE.min,
            max: ACTIVE_SESSION_LIMIT_RANGE.max,
            default: 2,
        },
        {
            path: 'application.admin.users.active_session_limit',
            label: 'active session limit',
            unit: 'minutes',
            min: ACTIVE_SESSION_LIMIT_RANGE.min,
            max: ACTIVE_SESSION_LIMIT_RANGE.max,
            default: 2,
        },
        {
            path: 'application.admin.users.inactivity_time',
            label: 'inactivity time',
            unit: 'minutes',
            min: 1,
            max: 480,
            default: 120,
        },
        {
            path: 'application.admin.users.warning_logout_time',
            label: 'warning logout time',
            unit: 'minutes',
            min: 0,
            max: 60,
            default: 5,
        },
        {
            path: 'application.admin.users.group_membership_check_interval',
            label: 'group membership check interval',
            unit: 'minutes',
            min: 0,
            default: 0,
        },
        {
            path: 'application.admin.reports.report_filter_days',
            label: 'report filter days',
            unit: 'days',
            min: REPORT_FILTER_DAYS_RANGE.min,
            max: REPORT_FILTER_DAYS_RANGE.max,
            default: 1,
        },
    ];

    /**
     * Numeric leaves of #EXPECTED_STRUCTURE that are intentionally NOT covered
     * by #NUMERIC_RULES, with the reason. Used by the acceptance test that
     * guards against a numeric field silently escaping validation again
     * (`numericLeafPaths()` below reports any numeric leaf missing from both
     * this set and #NUMERIC_RULES).
     */
    static #NUMERIC_LEAVES_EXCLUDED_FROM_RULES = new Set([
        // Has its own dedicated validator (#validateReopenCasesOnlyLastDays):
        // its range (0-36500 days) and error message don't fit the generic
        // #assertIntegerInRange shape.
        'application.agente.casos.reopen_cases_only_last_days',
        // Out of the scope declared by this PR (MSKT-1380): no reported bug,
        // no SSOT/Joi rule on the frontend. Move to #NUMERIC_RULES instead of
        // this list if validation is ever required.
        'application.agente.casos.folio_length',
        'application.agente.casos.max_cases_per_user',
        'application.agente.files_extensions.maximun_size_allowed',
        'application.agente.files_extensions.quantity_files_allowed',
        'application.agente.geolocation.max_map_markers',
    ]);

    static #collectNumericLeafPaths(node, path, acc) {
        for (const key of Object.keys(node)) {
            const value = node[key];
            const currentPath = path ? `${path}.${key}` : key;
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                Behaviors.#collectNumericLeafPaths(value, currentPath, acc);
            } else if (typeof value === 'number') {
                acc.push(currentPath);
            }
        }
        return acc;
    }

    /**
     * Every numeric leaf declared in #EXPECTED_STRUCTURE (dot path, relative
     * to `application`), for tests that verify #NUMERIC_RULES coverage.
     */
    static numericLeafPaths() {
        return Behaviors.#collectNumericLeafPaths(Behaviors.#EXPECTED_STRUCTURE.application, 'application', []);
    }

    /** @see #NUMERIC_LEAVES_EXCLUDED_FROM_RULES */
    static numericLeafExclusions() {
        return [...Behaviors.#NUMERIC_LEAVES_EXCLUDED_FROM_RULES];
    }

    /**
     * Read-only snapshot of #NUMERIC_RULES (path/min/max/fallback), for the
     * migration-lockstep test that guards the repair migration against
     * silently missing a rule.
     */
    static numericRules() {
        return Behaviors.#NUMERIC_RULES.map(({ path, min = 0, max, default: fallback }) => ({
            path,
            min,
            max,
            fallback: fallback ?? min,
        }));
    }

    constructor(data, { strict = true } = {}) {
        super('behaviors', data);
        // The repository builds a new GlobalConfigurations on every read, so the
        // hydration path passes `strict: false`: a legacy out-of-range value is
        // then normalized instead of making the whole global configuration
        // unreadable. Write paths (create / merge) keep the strict default.
        this.ensureDataStructure(data, { strict });
    }

    /**
     * @param {Object} data
     * @param {{ strict?: boolean }} [options] - When `strict` is false (hydration
     *   from persistence) an invalid numeric value is normalized to its rule
     *   default and logged. Write paths pass `strict: true` (the default) so the
     *   operation is rejected with a ValidationFailError.
     */
    ensureDataStructure(data, { strict = true } = {}) {
        const unexpectedKeys = [];
        this.#validateKeysRecursively(Behaviors.#EXPECTED_STRUCTURE, data, 'behaviors', unexpectedKeys);
        if (unexpectedKeys.length > 0) {
            Helper.logWarning(
                `Invalid Layouts structure (settings.behaviors). Unexpected keys: ${unexpectedKeys.join(', ')}`
            );
        }
        for (const rule of Behaviors.#NUMERIC_RULES) {
            this.#validateIntegerRange(data, rule, strict);
        }
        this.#validateReopenCasesOnlyLastDays(data);
        this.#validateWarningLogoutBeforeInactivity(data, strict);
        this.#validateReopenCasesOnlyLastDays(data);
    }

    /**
     * Cross-field rule: a non-zero warning_logout_time must fire before
     * inactivity_time expires. Runs after #validateIntegerRange, which already
     * coerced both fields to numbers, but the raw values are still read first so
     * an absent key is never confused with NaN.
     */
    #validateWarningLogoutBeforeInactivity(data, strict) {
        const users = data.application?.admin?.users;
        const rawInactivityTime = users?.inactivity_time;
        const rawWarningLogout = users?.warning_logout_time;
        if (rawInactivityTime === undefined || rawWarningLogout === undefined) {
            return;
        }

        const inactivityTime = Number(rawInactivityTime);
        const warningLogout = Number(rawWarningLogout);

        if (warningLogout > 0 && warningLogout >= inactivityTime) {
            const fullPath = 'settings.behaviors.application.admin.users.warning_logout_time';
            const message = 'Invalid warning logout time value, the value must be lower than inactivity time';

            if (strict) {
                throw new ValidationFailError(message, fullPath);
            }
            Helper.logDebug(
                `Legacy invalid value for ${fullPath} (${warningLogout} >= inactivity_time ${inactivityTime}); ` +
                    `normalized to 0 (disabled). Reason: ${message}`
            );
            users.warning_logout_time = 0;
        }
    }

    #validateIntegerRange(data, rule, strict) {
        const { path, min = 0 } = rule;
        const keys = path.split('.');
        const leaf = keys[keys.length - 1];
        const parent = keys.slice(0, -1).reduce((acc, key) => acc?.[key], data);
        const value = parent?.[leaf];
        if (value === undefined || value === null) {
            return;
        }

        try {
            this.#assertIntegerInRange(value, rule);
            // Store every valid value as a number so no domain consumer ever
            // compares the raw string form of a numeric field (the API layer
            // may submit numeric strings).
            if (parent && typeof parent === 'object') {
                parent[leaf] = Number(value);
            }
        } catch (error) {
            if (strict) {
                throw error;
            }
            const fallback = rule.default ?? min;
            Helper.logDebug(
                `Legacy invalid value for settings.behaviors.${path} (${JSON.stringify(value)}); ` +
                    `normalized to ${fallback}. Reason: ${error.message}`
            );
            if (parent && typeof parent === 'object') {
                parent[leaf] = fallback;
            }
        }
    }

    #assertIntegerInRange(value, { path, label, unit, min = 0, max }) {
        const fullPath = `settings.behaviors.${path}`;

        if (typeof value !== 'number' && typeof value !== 'string') {
            throw new ValidationFailError(`Invalid ${label} value, the value must be a number`, fullPath);
        }

        const parsed = Number(value);

        if (Number.isNaN(parsed) || (typeof value === 'string' && value.trim() === '')) {
            throw new ValidationFailError(`Invalid ${label} value, the value must be a number`, fullPath);
        }

        if (!Number.isInteger(parsed)) {
            throw new ValidationFailError(
                `Invalid ${label} value, the value must be a whole number of ${unit}`,
                fullPath
            );
        }

        if (parsed < min) {
            throw new ValidationFailError(
                `Invalid ${label} value, the value must not be lower than ${min} ${unit}`,
                fullPath
            );
        }

        if (max !== undefined && parsed > max) {
            throw new ValidationFailError(`Invalid ${label} value, the value must not exceed ${max} ${unit}`, fullPath);
        }
    }

    #validateReopenCasesOnlyLastDays(data) {
        const value = data?.application?.agente?.casos?.reopen_cases_only_last_days;
        if (value === undefined || value === null) {
            return;
        }

        const isUnparseableShape =
            typeof value === 'boolean' ||
            typeof value === 'object' ||
            (typeof value === 'string' && value.trim() === '');
        const parsed = Number(value);

        if (isUnparseableShape || !Number.isInteger(parsed) || parsed < 0 || parsed > REOPEN_WINDOW_MAX_DAYS) {
            throw new ValidationFailError(REOPEN_WINDOW_INVALID_MESSAGE, REOPEN_WINDOW_PATH);
        }
    }

    #validateKeysRecursively(expected, actual, path, unexpectedKeys) {
        for (const key of Object.keys(expected)) {
            const expectedValue = expected[key];

            if (actual === undefined || actual === null || !(key in actual)) {
                if (actual && typeof actual === 'object') {
                    if (Array.isArray(expectedValue)) {
                        actual[key] = [...expectedValue];
                    } else if (expectedValue !== null && typeof expectedValue === 'object') {
                        actual[key] = structuredClone(expectedValue);
                    } else {
                        actual[key] = expectedValue;
                    }
                }
                continue;
            }

            if (
                expectedValue !== null &&
                typeof expectedValue === 'object' &&
                !Array.isArray(expectedValue) &&
                Object.keys(expectedValue).length > 0
            ) {
                this.#validateKeysRecursively(expectedValue, actual[key], `${path}.${key}`, unexpectedKeys);
            }
        }
        if (actual !== undefined && actual !== null && typeof actual === 'object' && !Array.isArray(actual)) {
            for (const key of Object.keys(actual)) {
                if (!(key in expected)) {
                    unexpectedKeys.push(`${path}.${key}`);
                }
            }
        }
    }
}
