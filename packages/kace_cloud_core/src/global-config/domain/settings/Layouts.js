import { ConfigurationAggregate } from './ConfigurationAggregate';
import { Helper } from '../../../shared/index.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError';
import { charLimitKey, getCharLimitIssue, isMaxBelowMin, parseCharLimitKey } from './clientFieldCharLimits.js';

const CHAR_LIMITS_PATH = 'settings.layouts.application.agente.clients.fields_max_min';

const CHAR_LIMIT_ISSUE_REASONS = {
    not_a_number: 'the value must be a number',
    not_integer: 'the value must be a whole number',
    negative: 'the value must not be lower than 0',
    max_below_min: 'the value must not be lower than the min',
};

export class Layouts extends ConfigurationAggregate {
    static #EXPECTED_STRUCTURE = {
        application: {
            admin: {
                cases: {
                    enable_custom_view: true,
                    custom_view_name: '',
                    cases_admin_refresh_min: '1',
                    visible_columns: [],
                },
                clients: {
                    sexo: '',
                    email: '',
                    nombres: '',
                    telefono: '',
                    apellido1: '',
                    apellido2: '',
                    documento: '',
                    reference: '',
                    habeas_data: '',
                    estado_civil: '',
                    email_alterno: '',
                    nombre_empresa: '',
                    tipo_documento: '',
                    fecha_nacimiento: '',
                    telefono_alterno: '',
                    campos_extra1: '',
                    campos_extra2: '',
                    campos_extra3: '',
                },
                classifications: {
                    label_1: '',
                    label_2: '',
                    label_3: '',
                    label_4: '',
                    label_5: '',
                    label_6: '',
                    label_7: '',
                    label_8: '',
                    label_9: '',
                    label_10: '',
                },
            },
            agente: {
                agent: {
                    my_cases: true,
                    show_boards: true,
                    enable_custom_view: true,
                    show_my_created_cases: true,
                    show_my_assigned_cases: true,
                    show_interactions: true,
                    show_agent_interactions: false,
                    show_case: true,
                    show_client: true,
                    show_transitions: true,
                    show_subcase: true,
                    show_client_data: true,
                    cases_agent_refresh_min: '1',
                },
                cases: {
                    express_cases: [],
                    show_event_log: true,
                    show_attachments: true,
                    show_description: true,
                    account_to_send_link: '',
                    template_to_send_link: '',
                    allow_client_send_attachments: true,
                    labelCases: null,
                    show_sheduler: null,
                    show_history: null,
                    case_client_form: null,
                    show_comment_tab: null,
                    show_subcases_button: true,
                    show_cases_button: true,
                    show_save_client_button: true,
                    show_new_client_button: true,
                    show_time_counter: true,
                    show_notifications: false,
                    notifications_one_script_form: '',
                    refresh_tab_case: false,
                    refresh_tab_customer: false,
                    refresh_tab_transitions: false,
                    refresh_tab_subcases: false,
                    refresh_tab_comments: false,
                    refresh_tab_agenda: true,
                    refresh_tab_logs: true,
                    refresh_tab_interactions: false,
                    refresh_tab_notifications: false,
                    show_columns_dropdown: true,
                    show_time_description_prefixes: true,
                    headers_labels: [],
                },
                header: {
                    helps: true,
                    custom_logo: '',
                    search_clients: true,
                    high_impact_fields: true,
                    total_cases_by_ans: true,
                    my_agenda: true,
                },
                clients: {
                    fields: {},
                    habeasData: true,
                    open_cases: true,
                    client_data: true,
                    close_cases: true,
                    fields_copy: {},
                    fields_edit: {},
                    custom_form_id: '',
                    fields_max_min: {},
                    fields_required: {},
                    content_habeas_data: '',
                    get_list_field_to_show: true,
                    show_update_button: true,
                    show_aux_client_expanded: false,
                    hide_client_form: false,
                },
                calendar: {
                    oneScript_calendar: '',
                },
                search_clients: {
                    sexo_bool: false,
                    email_bool: false,
                    nombres_bool: true,
                    telefono_bool: false,
                    apellido1_bool: false,
                    apellido2_bool: false,
                    documento_bool: true,
                    reference_bool: true,
                    estado_civil_bool: false,
                    email_alterno_bool: false,
                    nombre_empresa_bool: false,
                    tipo_documento_bool: false,
                    fecha_nacimiento_bool: false,
                    telefono_alterno_bool: false,
                    campos_extra1_bool: false,
                    campos_extra2_bool: false,
                    campos_extra3_bool: false,
                },
                interactions: {
                    enable_view_interaction: false,
                },
            },
        },
    };

    /**
     * @param {Object} data
     * @param {{ strict?: boolean }} [options] - Hydration from persistence passes
     *   `strict: false` so a legacy invalid value is cleared instead of making the
     *   whole global configuration unreadable; write paths keep the strict default.
     */
    constructor(data, { strict = true } = {}) {
        super('layouts', data);
        this.ensureDataStructure(data, { strict });
    }

    ensureDataStructure(data, { strict = true } = {}) {
        const unexpectedKeys = [];
        this.#validateKeysRecursively(Layouts.#EXPECTED_STRUCTURE, data, 'layouts', unexpectedKeys);
        if (unexpectedKeys.length > 0) {
            Helper.logWarning(
                `Invalid Layouts structure (settings.layouts). Unexpected keys: ${unexpectedKeys.join(', ')}`
            );
        }
        this.#validateBusinessRules(data);
        this.#validateClientFieldCharLimits(data, strict);
    }

    #validateClientFieldCharLimits(data, strict) {
        const limits = data?.application?.agente?.clients?.fields_max_min;
        if (!limits || typeof limits !== 'object') {
            return;
        }

        const limitKeys = Object.keys(limits).filter((key) => parseCharLimitKey(key));

        for (const key of limitKeys) {
            const issue = getCharLimitIssue(limits[key]);
            if (issue) {
                this.#rejectOrNormalizeCharLimit(limits, key, issue, strict);
            }
        }

        for (const key of limitKeys) {
            const { field, bound } = parseCharLimitKey(key);
            if (bound === 'max' && isMaxBelowMin(limits[charLimitKey(field, 'min')], limits[key])) {
                this.#rejectOrNormalizeCharLimit(limits, key, 'max_below_min', strict);
            }
        }
    }

    #rejectOrNormalizeCharLimit(limits, key, issue, strict) {
        const fullPath = `${CHAR_LIMITS_PATH}.${key}`;
        const message = `Invalid ${key} value, ${CHAR_LIMIT_ISSUE_REASONS[issue]}`;

        if (strict) {
            throw new ValidationFailError(message, fullPath);
        }

        const normalized = Layouts.#legacyCharLimitFallback(key, limits[key], issue);
        Helper.logWarning(
            `Legacy invalid value for ${fullPath} (${JSON.stringify(limits[key])}); ` +
                `normalized to ${JSON.stringify(normalized)}. Reason: ${message}`
        );
        limits[key] = normalized;
    }

    /**
     * FieldValidationRule compares lengths against the stored number, so a legacy
     * decimal min/max already enforced the next whole length inward: keep it.
     * Anything else never acted as a usable limit and becomes "no limit".
     */
    static #legacyCharLimitFallback(key, value, issue) {
        if (issue !== 'not_integer' || Number(value) < 0) {
            return '';
        }

        return parseCharLimitKey(key).bound === 'min' ? Math.ceil(Number(value)) : Math.floor(Number(value));
    }

    #validateBusinessRules(data) {
        const adminCases = data?.application?.admin?.cases;
        if (adminCases?.enable_custom_view && !adminCases?.custom_view_name) {
            adminCases.custom_view_name = 'view_case_details';
        }

        const agenteCases = data?.application?.agente?.cases;
        if (agenteCases && !agenteCases.show_notifications) {
            agenteCases.notifications_one_script_form = '';
        }
    }

    #validateKeysRecursively(expected, actual, path, unexpectedKeys) {
        for (const key of Object.keys(expected)) {
            const expectedValue = expected[key];

            if (actual === undefined || actual === null || !(key in actual)) {
                if (actual && typeof actual === 'object') {
                    actual[key] = Array.isArray(expectedValue) ? [...expectedValue] : expectedValue;
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
