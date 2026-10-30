import { ValidationFailError } from '../../src/shared/errors/ValidationFailError';
import { ConfigurationAggregate } from '../../src/global-config/domain/settings/ConfigurationAggregate';
import { Settings } from '../../src/global-config/index.js';
import { Behaviors } from '../../src/global-config/domain/settings/Behaviors';
import { Layouts } from '../../src/global-config/domain/settings/Layouts';
import { CustomFields } from '../../src/global-config/domain/settings/CustomFields';
import { SETTINGS } from './domain/SettingsMother';
import { Helper } from '../../src/shared/index.js';
import { jest } from '@jest/globals';

describe('ConfigurationAggregate', () => {
    let config;

    beforeEach(() => {
        config = new ConfigurationAggregate('testType', {
            application: {
                agente: { setting1: 'value1' },
                admin: { setting2: 'value2' },
            },
        });
    });

    it('should initialize with the specified type and application data', () => {
        expect(config.type).toBe('testType');
        expect(config.toJson()).toEqual({
            application: {
                agente: { setting1: 'value1' },
                admin: { setting2: 'value2' },
            },
        });
    });

    it('getConfig should retrieve the correct setting for existing modules', () => {
        expect(config.getConfig('agente', 'setting1')).toBe('value1');
        expect(config.getConfig('admin', 'setting2')).toBe('value2');
    });

    it('getConfig should return null for non-existent settings', () => {
        expect(config.getConfig('agente', 'nonExistent')).toBeNull();
        expect(config.getConfig('nonExistentApplication', 'setting1')).toBeNull();
    });

    it('setConfig should add or update settings for existing modules', () => {
        config.setConfig('agente', 'setting1', 'newValue');
        expect(config.getConfig('agente', 'setting1')).toBe('newValue');

        config.setConfig('admin', 'setting2', 'anotherValue');
        expect(config.getConfig('admin', 'setting2')).toBe('anotherValue');
    });

    it('setConfig should create a new setting if the module does not exist', () => {
        config.setConfig('agente', 'newSetting', 'newValue');
        expect(config.getConfig('agente', 'newSetting')).toBe('newValue');
    });

    it('toJson should return the complete settings object', () => {
        expect(config.toJson()).toEqual({
            application: {
                agente: { setting1: 'value1' },
                admin: { setting2: 'value2' },
            },
        });
    });

    it('setConfig should throw an error for invalid applications', () => {
        expect(() => config.setConfig('invalidApplication', 'setting1', 'value')).toThrow(
            'Invalid application: invalidApplication. Valid applications are: agente, admin'
        );
    });

    it('setConfig should throw an error for invalid module names', () => {
        expect(() => config.setConfig('agente', '', 'value')).toThrow('Module name must be a non-empty string.');
        expect(() => config.setConfig('agente', null, 'value')).toThrow('Module name must be a non-empty string.');
    });

    it('should throw an error for invalid initial data structure', () => {
        expect(() => {
            new ConfigurationAggregate('testType', {});
        }).toThrow('Invalid data structure: data.application must contain both "agente" and "admin".');
    });

    describe('assignment_active_session_limit validation', () => {
        const baseData = () => ({
            application: {
                admin: { users: { inactivity_time: 120, warning_logout_time: 5, active_session_limit: 2 } },
                agente: { casos: {} },
            },
        });

        it('acepta un entero dentro de 1-60', () => {
            const data = baseData();
            data.application.agente.casos.assignment_active_session_limit = 15;
            expect(() => new Behaviors(data)).not.toThrow();
        });

        it('rechaza un valor no numérico', () => {
            const data = baseData();
            data.application.agente.casos.assignment_active_session_limit = 'abc';
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('rechaza un valor negativo', () => {
            const data = baseData();
            data.application.agente.casos.assignment_active_session_limit = -1;
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('rechaza un valor mayor a 60', () => {
            const data = baseData();
            data.application.agente.casos.assignment_active_session_limit = 61;
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('rechaza un decimal', () => {
            const data = baseData();
            data.application.agente.casos.assignment_active_session_limit = 2.5;
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('no lanza cuando la clave está ausente', () => {
            expect(() => new Behaviors(baseData())).not.toThrow();
        });

        it('rechaza 0: los consumidores (KnexGroupsRepository, AssignationService) tratan un valor no positivo como "sin configurar" y no lo respetarían', () => {
            const data = baseData();
            data.application.agente.casos.assignment_active_session_limit = 0;
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('acepta 1 (borde inferior)', () => {
            const data = baseData();
            data.application.agente.casos.assignment_active_session_limit = 1;
            expect(() => new Behaviors(data)).not.toThrow();
        });

        it('acepta 60 (borde superior)', () => {
            const data = baseData();
            data.application.agente.casos.assignment_active_session_limit = 60;
            expect(() => new Behaviors(data)).not.toThrow();
        });
    });

    describe('reopen_cases_only_last_days validation', () => {
        const baseData = () => ({
            application: {
                admin: { users: { inactivity_time: 120, warning_logout_time: 5, active_session_limit: 2 } },
                agente: { casos: {} },
            },
        });

        it('acepta 7', () => {
            const data = baseData();
            data.application.agente.casos.reopen_cases_only_last_days = 7;
            expect(() => new Behaviors(data)).not.toThrow();
        });

        it('acepta 0 (ilimitado)', () => {
            const data = baseData();
            data.application.agente.casos.reopen_cases_only_last_days = 0;
            expect(() => new Behaviors(data)).not.toThrow();
        });

        it('no lanza cuando la clave está ausente', () => {
            expect(() => new Behaviors(baseData())).not.toThrow();
        });

        it('hidrata 7 cuando la clave está ausente', () => {
            const behaviors = new Behaviors(baseData());
            expect(behaviors.getConfig('agente', 'casos').reopen_cases_only_last_days).toBe(7);
        });

        it('rechaza un valor no numérico', () => {
            const data = baseData();
            data.application.agente.casos.reopen_cases_only_last_days = 'abc';
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('rechaza un valor negativo', () => {
            const data = baseData();
            data.application.agente.casos.reopen_cases_only_last_days = -1;
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('rechaza un decimal', () => {
            const data = baseData();
            data.application.agente.casos.reopen_cases_only_last_days = 2.5;
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('rechaza cadena vacía, boolean y array', () => {
            for (const invalid of ['', '  ', true, []]) {
                const data = baseData();
                data.application.agente.casos.reopen_cases_only_last_days = invalid;
                expect(() => new Behaviors(data)).toThrow(ValidationFailError);
            }
        });

        it('rechaza valores por encima de 36500', () => {
            const data = baseData();
            data.application.agente.casos.reopen_cases_only_last_days = 36501;
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });
    });

    describe('admin block backfill (regression)', () => {
        it('reconstruye todo el bloque admin cuando la fila almacenada no tiene la clave admin', () => {
            const behaviors = new Behaviors({ application: { agente: {} } }, { strict: false });

            expect(behaviors.getConfig('admin', 'users')).toMatchObject({
                inactivity_time: 120,
                warning_logout_time: 5,
                active_session_limit: 2,
            });
            expect(behaviors.getConfig('admin', 'reports')).toEqual({ report_filter_days: 1 });
            expect(behaviors.getConfig('admin', 'menus')).toEqual({ hidden_menus: [] });
        });

        it('expone el bloque admin reconstruido también en toJson()', () => {
            const behaviors = new Behaviors({ application: { agente: {} } }, { strict: false });

            expect(behaviors.toJson().application.admin.users.inactivity_time).toBe(120);
        });
    });

    /**
     * MSKT-1392 (F0-1). `allow_case_reclassification` es un flag booleano espejado entre
     * `#EXPECTED_STRUCTURE` y los 5 puntos de edición del General Setup del frontend. El
     * backfill de `#validateKeysRecursively` es lo que hace que un tenant que nunca tocó el
     * toggle lea `false` y no `undefined`; sin esta ancla, borrar la clave de la estructura
     * no rompería ningún test y el flag degradaría a `undefined` en silencio.
     */
    describe('allow_case_reclassification default (MSKT-1392)', () => {
        it('rellena el flag en false cuando la fila almacenada no lo trae', () => {
            const behaviors = new Behaviors({ application: { agente: { casos: {} } } }, { strict: false });

            expect(behaviors.getConfig('agente', 'casos').allow_case_reclassification).toBe(false);
        });

        it('respeta el valor persistido cuando el tenant ya activó el flag', () => {
            const behaviors = new Behaviors(
                { application: { agente: { casos: { allow_case_reclassification: true } } } },
                { strict: false }
            );

            expect(behaviors.toJson().application.agente.casos.allow_case_reclassification).toBe(true);
        });
    });

    describe('numeric fields are stored as numbers', () => {
        const baseData = () => ({
            application: {
                admin: { users: { inactivity_time: 120, warning_logout_time: 5, active_session_limit: 2 } },
                agente: { casos: {} },
            },
        });

        it('no lanza y coacciona a número cuando inactivity_time y warning_logout_time llegan como string', () => {
            const data = baseData();
            data.application.admin.users.inactivity_time = '120';
            data.application.admin.users.warning_logout_time = '30';

            const behaviors = new Behaviors(data);

            const users = behaviors.getConfig('admin', 'users');
            expect(users.inactivity_time).toBe(120);
            expect(users.warning_logout_time).toBe(30);
        });

        it('la regla cruzada compara numéricamente, no lexicográficamente ("30" < "120")', () => {
            const data = baseData();
            data.application.admin.users.inactivity_time = '120';
            data.application.admin.users.warning_logout_time = '30';

            expect(() => new Behaviors(data)).not.toThrow();
        });

        it('la regla cruzada sigue rechazando un warning_logout_time string que no es menor que inactivity_time', () => {
            const data = baseData();
            data.application.admin.users.inactivity_time = '30';
            data.application.admin.users.warning_logout_time = '30';

            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });
    });

    describe('report_filter_days validation', () => {
        const baseData = () => ({
            application: {
                admin: {
                    users: { inactivity_time: 120, warning_logout_time: 5, active_session_limit: 2 },
                    reports: { report_filter_days: 1 },
                },
                agente: { casos: {} },
            },
        });

        it('acepta un entero dentro de 1-30', () => {
            const data = baseData();
            data.application.admin.reports.report_filter_days = 15;
            expect(() => new Behaviors(data)).not.toThrow();
        });

        it('rechaza un valor negativo en modo estricto', () => {
            const data = baseData();
            data.application.admin.reports.report_filter_days = -5;
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('rechaza un valor no numérico en modo estricto', () => {
            const data = baseData();
            data.application.admin.reports.report_filter_days = 'abc';
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('rechaza un valor mayor a 30 en modo estricto', () => {
            const data = baseData();
            data.application.admin.reports.report_filter_days = 31;
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('normaliza un valor heredado fuera de rango a 1 en modo no estricto', () => {
            const data = baseData();
            data.application.admin.reports.report_filter_days = -5;

            const behaviors = new Behaviors(data, { strict: false });

            expect(behaviors.getConfig('admin', 'reports').report_filter_days).toBe(1);
        });
    });

    describe('group_membership_check_interval validation', () => {
        const baseData = () => ({
            application: {
                admin: {
                    users: {
                        inactivity_time: 120,
                        warning_logout_time: 5,
                        active_session_limit: 2,
                        group_membership_check_interval: 0,
                    },
                },
                agente: { casos: {} },
            },
        });

        it('acepta 0 (deshabilitado)', () => {
            const data = baseData();
            expect(() => new Behaviors(data)).not.toThrow();
        });

        it('acepta un entero positivo', () => {
            const data = baseData();
            data.application.admin.users.group_membership_check_interval = 30;
            expect(() => new Behaviors(data)).not.toThrow();
        });

        it('rechaza un valor negativo en modo estricto', () => {
            const data = baseData();
            data.application.admin.users.group_membership_check_interval = -50;
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('rechaza un valor no numérico en modo estricto', () => {
            const data = baseData();
            data.application.admin.users.group_membership_check_interval = 'abc';
            expect(() => new Behaviors(data)).toThrow(ValidationFailError);
        });

        it('normaliza un valor heredado negativo a 0 en modo no estricto', () => {
            const data = baseData();
            data.application.admin.users.group_membership_check_interval = -50;

            const behaviors = new Behaviors(data, { strict: false });

            expect(behaviors.getConfig('admin', 'users').group_membership_check_interval).toBe(0);
        });
    });
});

describe('NUMERIC_RULES coverage (acceptance criterion)', () => {
    // Guards against a numeric field silently escaping validation again (the
    // exact defect this round's review caught for group_membership_check_interval):
    // every numeric leaf of #EXPECTED_STRUCTURE must either have a domain rule
    // in #NUMERIC_RULES or be explicitly excluded, with a reason, in
    // #NUMERIC_LEAVES_EXCLUDED_FROM_RULES.
    it('covers every numeric leaf of EXPECTED_STRUCTURE not explicitly excluded', () => {
        const ruledPaths = new Set(Behaviors.numericRules().map((rule) => rule.path));
        const excluded = new Set(Behaviors.numericLeafExclusions());

        const uncovered = Behaviors.numericLeafPaths().filter((leaf) => !ruledPaths.has(leaf) && !excluded.has(leaf));

        expect(uncovered).toEqual([]);
    });
});

describe('migration lockstep (repair migration mirrors Behaviors NUMERIC_RULES)', () => {
    // Guards against the HIGH regression this round's review caught: a rule
    // added to #NUMERIC_RULES without a matching repair entry in the legacy
    // data migration. Fails if either side adds/changes a rule alone.
    it('has one migration repair rule for every Behaviors NUMERIC_RULES entry, with matching bounds', async () => {
        const { NUMERIC_REPAIR_RULES } =
            await import('../../../kace_cloud_database/migrations/20260904120000_normalize_legacy_behaviors_numeric_settings.js');

        const domainRules = Behaviors.numericRules()
            .map((rule) => ({
                path: rule.path.replace(/^application\./, ''),
                min: rule.min,
                max: rule.max,
                fallback: rule.fallback,
            }))
            .sort((a, b) => a.path.localeCompare(b.path));

        const migrationRules = NUMERIC_REPAIR_RULES.map((rule) => ({
            path: rule.path.join('.'),
            min: rule.min ?? 0,
            max: rule.max,
            fallback: rule.fallback,
        })).sort((a, b) => a.path.localeCompare(b.path));

        expect(migrationRules).toEqual(domainRules);
    });
});

describe('Module Initialization', () => {
    it('should initialize Behaviors correctly', () => {
        const behaviors = new Behaviors(SETTINGS.behaviors);
        expect(behaviors.type).toBe('behaviors');
        expect(behaviors.getConfig('agente', 'casos')).toBeDefined();
    });

    it('should initialize Layouts correctly', () => {
        const layouts = new Layouts(SETTINGS.layouts);
        expect(layouts.type).toBe('layouts');
        expect(layouts.getConfig('agente', 'header')).toBeDefined();
    });

    it('should initialize CustomFields correctly', () => {
        const customFields = new CustomFields(SETTINGS.custom_fields);
        expect(customFields.type).toBe('custom_fields');
        expect(customFields.getConfig('agente', 'flow_id')).toBe('');
    });
});

describe('Settings', () => {
    let settings;

    beforeEach(() => {
        settings = new Settings(SETTINGS);
    });

    it('should initialize with valid settings', () => {
        expect(settings.layouts).toBeDefined();
        expect(settings.behaviors).toBeDefined();
        expect(settings.customFields).toBeDefined();
    });

    it('should throw error for missing settings', () => {
        expect(() => new Settings()).toThrow(new Error('Settings are required'));
        expect(() => new Settings({})).toThrow(new Error('Settings are required'));
    });

    it('should throw error for missing required properties', () => {
        const invalidSettings = { layouts: SETTINGS.layouts };
        expect(() => new Settings(invalidSettings)).toThrow(new Error('Behaviors are required'));
    });

    it('value should return the correct settings object', () => {
        expect(settings.value).toEqual({
            layouts: settings.layouts.toJson(),
            behaviors: settings.behaviors.toJson(),
            custom_fields: settings.customFields.toJson(),
        });
    });
});

describe('Layouts validation', () => {
    it('should set default value when a required key is missing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.layouts);
        delete data.application.admin.cases;

        // Act
        const layouts = new Layouts(data);

        // Assert
        const cases = layouts.getConfig('admin', 'cases');
        expect(cases).toBeDefined();
        expect(cases.enable_custom_view).toBe(true);
        expect(cases.custom_view_name).toBe('view_case_details');
    });

    it('should log a warning but not throw when an unexpected key is present', () => {
        // Arrange
        const logWarningSpy = jest.spyOn(Helper, 'logWarning').mockImplementation(() => {});
        const data = structuredClone(SETTINGS.layouts);
        data.application.admin.unknown_module = { foo: 'bar' };

        // Act & Assert
        expect(() => new Layouts(data)).not.toThrow();
        expect(logWarningSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected keys'));
        logWarningSpy.mockRestore();
    });

    it('should set default value when a deeply nested key is missing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.layouts);
        delete data.application.agente.search_clients.documento_bool;

        // Act
        const layouts = new Layouts(data);

        // Assert
        const searchClients = layouts.getConfig('agente', 'search_clients');
        expect(searchClients.documento_bool).toBe(true);
    });

    it('accepts header my_agenda without treating it as unexpected', () => {
        const logWarningSpy = jest.spyOn(Helper, 'logWarning').mockImplementation(() => {});
        const data = structuredClone(SETTINGS.layouts);
        data.application.agente.header.my_agenda = false;

        const layouts = new Layouts(data);

        expect(layouts.getConfig('agente', 'header').my_agenda).toBe(false);
        expect(logWarningSpy).not.toHaveBeenCalled();
        logWarningSpy.mockRestore();
    });

    it('defaults header my_agenda to true when the key is missing', () => {
        const data = structuredClone(SETTINGS.layouts);
        delete data.application.agente.header.my_agenda;

        const layouts = new Layouts(data);

        expect(layouts.getConfig('agente', 'header').my_agenda).toBe(true);
    });

    it('should log a warning but not throw when a deeply nested unexpected key is present', () => {
        // Arrange
        const logWarningSpy = jest.spyOn(Helper, 'logWarning').mockImplementation(() => {});
        const data = structuredClone(SETTINGS.layouts);
        data.application.agente.header.unknown_field = true;

        // Act & Assert
        expect(() => new Layouts(data)).not.toThrow();
        expect(logWarningSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected keys'));
        logWarningSpy.mockRestore();
    });

    it('should set defaults for missing keys and not throw for unexpected keys', () => {
        // Arrange
        const logWarningSpy = jest.spyOn(Helper, 'logWarning').mockImplementation(() => {});
        const data = structuredClone(SETTINGS.layouts);
        data.application.agente.agent.invalid_key = true;

        // Act & Assert
        expect(() => new Layouts(data)).not.toThrow();
        expect(logWarningSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected keys'));
        logWarningSpy.mockRestore();
    });

    it('should accept valid data without throwing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.layouts);

        // Act & Assert
        expect(() => new Layouts(data)).not.toThrow();
    });

    it('should set default show_aux_client_expanded when key is missing', () => {
        const data = structuredClone(SETTINGS.layouts);
        delete data.application.agente.clients.show_aux_client_expanded;

        const layouts = new Layouts(data);
        const clients = layouts.getConfig('agente', 'clients');

        expect(clients.show_aux_client_expanded).toBe(false);
    });

    it('should set default hide_client_form when key is missing', () => {
        const data = structuredClone(SETTINGS.layouts);
        delete data.application.agente.clients.hide_client_form;

        const layouts = new Layouts(data);
        const clients = layouts.getConfig('agente', 'clients');

        expect(clients.hide_client_form).toBe(false);
    });

    it('should persist show_aux_client_expanded and hide_client_form when provided', () => {
        const data = structuredClone(SETTINGS.layouts);
        data.application.agente.clients.show_aux_client_expanded = true;
        data.application.agente.clients.hide_client_form = true;

        const layouts = new Layouts(data);
        const clients = layouts.getConfig('agente', 'clients');

        expect(clients.show_aux_client_expanded).toBe(true);
        expect(clients.hide_client_form).toBe(true);
    });

    it('should set default show_columns_dropdown and headers_labels for agente.cases when missing', () => {
        const data = structuredClone(SETTINGS.layouts);
        delete data.application.agente.cases.show_columns_dropdown;
        delete data.application.agente.cases.headers_labels;

        const layouts = new Layouts(data);
        const cases = layouts.getConfig('agente', 'cases');

        expect(cases.show_columns_dropdown).toBe(true);
        expect(cases.headers_labels).toEqual([]);
    });

    it('should accept show_columns_dropdown=false and a non-empty headers_labels without logging unexpected keys', () => {
        const logErrorSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        const data = structuredClone(SETTINGS.layouts);
        data.application.agente.cases.show_columns_dropdown = false;
        data.application.agente.cases.headers_labels = [{ key: 'reference', label: 'Consecutivo Custom' }];

        const layouts = new Layouts(data);
        const cases = layouts.getConfig('agente', 'cases');

        expect(cases.show_columns_dropdown).toBe(false);
        expect(cases.headers_labels).toEqual([{ key: 'reference', label: 'Consecutivo Custom' }]);
        expect(logErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unexpected keys'));
        logErrorSpy.mockRestore();
    });

    it('should set default show_time_description_prefixes for agente.cases when missing', () => {
        const data = structuredClone(SETTINGS.layouts);
        delete data.application.agente.cases.show_time_description_prefixes;

        const layouts = new Layouts(data);
        const cases = layouts.getConfig('agente', 'cases');

        expect(cases.show_time_description_prefixes).toBe(true);
    });

    it('should accept show_time_description_prefixes=false without logging unexpected keys', () => {
        const logWarningSpy = jest.spyOn(Helper, 'logWarning').mockImplementation(() => {});
        const data = structuredClone(SETTINGS.layouts);
        data.application.agente.cases.show_time_description_prefixes = false;

        const layouts = new Layouts(data);
        const cases = layouts.getConfig('agente', 'cases');

        expect(cases.show_time_description_prefixes).toBe(false);
        expect(logWarningSpy).not.toHaveBeenCalledWith(expect.stringContaining('show_time_description_prefixes'));
        logWarningSpy.mockRestore();
    });

    it('should set default show_notifications when key is missing', () => {
        const data = structuredClone(SETTINGS.layouts);
        delete data.application.agente.cases.show_notifications;

        const layouts = new Layouts(data);
        const cases = layouts.getConfig('agente', 'cases');

        expect(cases.show_notifications).toBe(false);
    });

    it('should set default notifications_one_script_form when key is missing', () => {
        const data = structuredClone(SETTINGS.layouts);
        delete data.application.agente.cases.notifications_one_script_form;

        const layouts = new Layouts(data);
        const cases = layouts.getConfig('agente', 'cases');

        expect(cases.notifications_one_script_form).toBe('');
    });

    it('should set default refresh_tab_notifications when key is missing', () => {
        const data = structuredClone(SETTINGS.layouts);
        delete data.application.agente.cases.refresh_tab_notifications;

        const layouts = new Layouts(data);
        const cases = layouts.getConfig('agente', 'cases');

        expect(cases.refresh_tab_notifications).toBe(false);
    });

    it('should persist notifications settings when show_notifications is true', () => {
        const data = structuredClone(SETTINGS.layouts);
        data.application.agente.cases.show_notifications = true;
        data.application.agente.cases.notifications_one_script_form = 'form-uuid';
        data.application.agente.cases.refresh_tab_notifications = true;

        const layouts = new Layouts(data);
        const cases = layouts.getConfig('agente', 'cases');

        expect(cases.show_notifications).toBe(true);
        expect(cases.notifications_one_script_form).toBe('form-uuid');
        expect(cases.refresh_tab_notifications).toBe(true);
    });

    it('should clear notifications_one_script_form when show_notifications is false', () => {
        const data = structuredClone(SETTINGS.layouts);
        data.application.agente.cases.show_notifications = false;
        data.application.agente.cases.notifications_one_script_form = 'form-uuid';

        const layouts = new Layouts(data);
        const cases = layouts.getConfig('agente', 'cases');

        expect(cases.show_notifications).toBe(false);
        expect(cases.notifications_one_script_form).toBe('');
    });

    it('should log a warning but not throw when agente clients has unexpected keys', () => {
        const logWarningSpy = jest.spyOn(Helper, 'logWarning').mockImplementation(() => {});
        const data = structuredClone(SETTINGS.layouts);
        data.application.agente.clients.unknown_client_option = true;

        expect(() => new Layouts(data)).not.toThrow();
        expect(logWarningSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected keys'));
        logWarningSpy.mockRestore();
    });
});

const VISIBLE_COLUMN_USE_CASES = [
    {
        name: 'basic default and estado columns',
        columns: [
            { column_name: 'reference', header_label: 'reference', cell_type: 'default' },
            { column_name: 'estadoactual', header_label: 'estadoactual', cell_type: 'estado' },
        ],
    },
    {
        name: 'nivel1 clasificacion with grouped expand enabled',
        columns: [
            {
                column_name: 'nivel1',
                header_label: 'nivel1',
                cell_type: 'clasificacion',
                expand_levels: true,
            },
        ],
    },
    {
        name: 'nivel5 clasificacion with grouped expand enabled',
        columns: [
            {
                column_name: 'nivel5',
                header_label: 'nivel5',
                cell_type: 'clasificacion',
                expand_levels: true,
            },
        ],
    },
    {
        name: 'nivel10 clasificacion with grouped expand enabled',
        columns: [
            {
                column_name: 'nivel10',
                header_label: 'nivel10',
                cell_type: 'clasificacion',
                expand_levels: true,
            },
        ],
    },
    {
        name: 'nivel column with grouped expand disabled for single-column mode',
        columns: [
            {
                column_name: 'nivel2',
                header_label: 'nivel2',
                cell_type: 'clasificacion',
                expand_levels: false,
            },
        ],
    },
    {
        name: 'legacy nivel clasificacion without expand_levels for backward compatibility',
        columns: [{ column_name: 'nivel1', header_label: 'nivel1', cell_type: 'clasificacion' }],
    },
    {
        name: 'separator clasificacion with grouped expand enabled',
        columns: [
            {
                column_name: 'clasificacion_path',
                header_label: 'clasificacion_path',
                cell_type: 'clasificacion',
                separator: '->',
                expand_levels: true,
            },
        ],
    },
    {
        name: 'separator clasificacion with grouped expand disabled',
        columns: [
            {
                column_name: 'clasificacion_path',
                header_label: 'clasificacion_path',
                cell_type: 'clasificacion',
                separator: ' -> ',
                expand_levels: false,
            },
        ],
    },
    {
        name: 'separator clasificacion without expand_levels',
        columns: [
            {
                column_name: 'clasificacion_path',
                header_label: 'clasificacion_path',
                cell_type: 'clasificacion',
                separator: '>',
            },
        ],
    },
    {
        name: 'flat clasificacion without separator',
        columns: [
            {
                column_name: 'custom_field',
                header_label: 'custom_field',
                cell_type: 'clasificacion',
            },
        ],
    },
    {
        name: 'mixed admin cases view configuration',
        columns: [
            { column_name: 'reference', header_label: 'reference', cell_type: 'default' },
            { column_name: 'estadoactual', header_label: 'estadoactual', cell_type: 'estado' },
            {
                column_name: 'nivel5',
                header_label: 'nivel5',
                cell_type: 'clasificacion',
                expand_levels: true,
            },
            {
                column_name: 'clasificacion_path',
                header_label: 'clasificacion_path',
                cell_type: 'clasificacion',
                separator: '->',
                expand_levels: false,
            },
        ],
    },
];

const buildLayoutsWithVisibleColumns = (visibleColumns) => {
    const data = structuredClone(SETTINGS.layouts);
    data.application.admin.cases.visible_columns = visibleColumns;
    return data;
};

const getAdminCasesVisibleColumns = (data) => new Layouts(data).getConfig('admin', 'cases').visible_columns;

describe('visible_columns', () => {
    it('should set default visible_columns when key is missing', () => {
        const data = structuredClone(SETTINGS.layouts);
        delete data.application.admin.cases.visible_columns;

        expect(getAdminCasesVisibleColumns(data)).toEqual([]);
    });

    it.each(VISIBLE_COLUMN_USE_CASES)('should preserve $name', ({ columns }) => {
        const data = buildLayoutsWithVisibleColumns(columns);

        expect(getAdminCasesVisibleColumns(data)).toEqual(columns);
    });

    it('should preserve visible_columns through Settings.value round-trip', () => {
        const visibleColumns = VISIBLE_COLUMN_USE_CASES.find(
            (useCase) => useCase.name === 'mixed admin cases view configuration'
        ).columns;
        const settingsData = structuredClone(SETTINGS);
        settingsData.layouts.application.admin.cases.visible_columns = visibleColumns;

        const settings = new Settings(settingsData);

        expect(settings.layouts.getConfig('admin', 'cases').visible_columns).toEqual(visibleColumns);
        expect(settings.value.layouts.application.admin.cases.visible_columns).toEqual(visibleColumns);
    });

    it('should preserve visible_columns in layouts.toJson()', () => {
        const visibleColumns = [
            {
                column_name: 'nivel1',
                header_label: 'nivel1',
                cell_type: 'clasificacion',
                expand_levels: true,
            },
            {
                column_name: 'clasificacion_path',
                header_label: 'clasificacion_path',
                cell_type: 'clasificacion',
                separator: '->',
                expand_levels: true,
            },
        ];
        const layouts = new Layouts(buildLayoutsWithVisibleColumns(visibleColumns));

        expect(layouts.toJson().application.admin.cases.visible_columns).toEqual(visibleColumns);
    });

    it('should accept empty visible_columns array without throwing', () => {
        expect(() => new Layouts(buildLayoutsWithVisibleColumns([]))).not.toThrow();
    });
});

describe('Behaviors validation', () => {
    it('should set default value when a required key is missing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.behaviors);
        delete data.application.agente.geolocation;

        // Act
        const behaviors = new Behaviors(data);

        // Assert
        const geolocation = behaviors.getConfig('agente', 'geolocation');
        expect(geolocation).toBeDefined();
        expect(geolocation.geolocation_login_bool).toBe(false);
    });

    it('should log a warning but not throw when an unexpected key is present', () => {
        // Arrange
        const logWarningSpy = jest.spyOn(Helper, 'logWarning').mockImplementation(() => {});
        const data = structuredClone(SETTINGS.behaviors);
        data.application.agente.unknown_module = { foo: 'bar' };

        // Act & Assert
        expect(() => new Behaviors(data)).not.toThrow();
        expect(logWarningSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected keys'));
        logWarningSpy.mockRestore();
    });

    it('should set default value when a deeply nested key is missing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.behaviors);
        delete data.application.agente.casos.order_type;

        // Act
        const behaviors = new Behaviors(data);

        // Assert
        const casos = behaviors.getConfig('agente', 'casos');
        expect(casos.order_type).toBe('');
    });

    it('should set default work_queue_sorting_rules when key is missing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.behaviors);
        delete data.application.agente.casos.work_queue_sorting_rules;

        // Act
        const behaviors = new Behaviors(data);

        // Assert
        const casos = behaviors.getConfig('agente', 'casos');
        expect(casos.work_queue_sorting_rules).toEqual([]);
    });

    it('should set default assignLastResponsibleIgnoreDefault when key is missing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.behaviors);
        delete data.application.agente.casos.assignLastResponsibleIgnoreDefault;

        // Act
        const behaviors = new Behaviors(data);

        // Assert
        const casos = behaviors.getConfig('agente', 'casos');
        expect(casos.assignLastResponsibleIgnoreDefault).toBe(false);
    });

    it('should log a warning but not throw when a deeply nested unexpected key is present', () => {
        // Arrange
        const logWarningSpy = jest.spyOn(Helper, 'logWarning').mockImplementation(() => {});
        const data = structuredClone(SETTINGS.behaviors);
        data.application.agente.casos.invalid_setting = 'bad';

        // Act & Assert
        expect(() => new Behaviors(data)).not.toThrow();
        expect(logWarningSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected keys'));
        logWarningSpy.mockRestore();
    });

    it('should accept valid data without throwing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.behaviors);

        // Act & Assert
        expect(() => new Behaviors(data)).not.toThrow();
    });

    it('should throw when warning_logout_time is not lower than inactivity_time', () => {
        const data = structuredClone(SETTINGS.behaviors);
        data.application.admin.users.inactivity_time = 10;
        data.application.admin.users.warning_logout_time = 10;
        expect(() => new Behaviors(data)).toThrow(ValidationFailError);
    });

    it('should throw when inactivity_time is below 1 minute', () => {
        const data = structuredClone(SETTINGS.behaviors);
        data.application.admin.users.inactivity_time = 0.5;
        data.application.admin.users.warning_logout_time = 0.25;
        expect(() => new Behaviors(data)).toThrow(ValidationFailError);
    });

    it('should throw when warning_logout_time is not a whole number of minutes', () => {
        const data = structuredClone(SETTINGS.behaviors);
        data.application.admin.users.inactivity_time = 60;
        data.application.admin.users.warning_logout_time = 0.5;
        expect(() => new Behaviors(data)).toThrow(ValidationFailError);
    });

    it('should accept warning_logout_time 0 when inactivity_time is 1', () => {
        const data = structuredClone(SETTINGS.behaviors);
        data.application.admin.users.inactivity_time = 1;
        data.application.admin.users.warning_logout_time = 0;
        expect(() => new Behaviors(data)).not.toThrow();
    });

    it('should set default onescript_cache_ttl_ms when onescript key is missing', () => {
        const data = structuredClone(SETTINGS.behaviors);
        delete data.application.agente.onescript;

        const behaviors = new Behaviors(data);

        const onescript = behaviors.getConfig('agente', 'onescript');
        expect(onescript).toBeDefined();
        expect(onescript.onescript_cache_ttl_ms).toBe(0);
    });

    it('should accept onescript_cache_ttl_ms 0', () => {
        const data = structuredClone(SETTINGS.behaviors);
        data.application.agente.onescript = { onescript_cache_ttl_ms: 0 };

        expect(() => new Behaviors(data)).not.toThrow();
    });

    it('should accept positive onescript_cache_ttl_ms', () => {
        const data = structuredClone(SETTINGS.behaviors);
        data.application.agente.onescript = { onescript_cache_ttl_ms: 300000 };

        expect(() => new Behaviors(data)).not.toThrow();
    });

    it('should throw when onescript_cache_ttl_ms is negative', () => {
        const data = structuredClone(SETTINGS.behaviors);
        data.application.agente.onescript = { onescript_cache_ttl_ms: -1 };

        expect(() => new Behaviors(data)).toThrow(ValidationFailError);
    });

    it('should throw when onescript_cache_ttl_ms is not a number', () => {
        const data = structuredClone(SETTINGS.behaviors);
        data.application.agente.onescript = { onescript_cache_ttl_ms: 'invalid' };

        expect(() => new Behaviors(data)).toThrow(ValidationFailError);
    });

    it('should throw when onescript_cache_ttl_ms is not an integer', () => {
        const data = structuredClone(SETTINGS.behaviors);
        data.application.agente.onescript = { onescript_cache_ttl_ms: 1.5 };

        expect(() => new Behaviors(data)).toThrow(ValidationFailError);
    });

    it('should log a warning but not throw when onescript has an unexpected key', () => {
        const logWarningSpy = jest.spyOn(Helper, 'logWarning').mockImplementation(() => {});
        const data = structuredClone(SETTINGS.behaviors);
        data.application.agente.onescript = {
            onescript_cache_ttl_ms: 0,
            onescript_auth_cognito_cache_ttl_ms: 1740000,
        };

        expect(() => new Behaviors(data)).not.toThrow();
        expect(logWarningSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected keys'));
        logWarningSpy.mockRestore();
    });

    it('should default async_case_post_processing to false when the key is missing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.behaviors);
        delete data.application.agente.casos.async_case_post_processing;

        // Act
        const behaviors = new Behaviors(data);

        // Assert
        const casos = behaviors.getConfig('agente', 'casos');
        expect(casos.async_case_post_processing).toBe(false);
    });

    it('should round-trip async_case_post_processing as true when provided', () => {
        // Arrange
        const data = structuredClone(SETTINGS.behaviors);
        data.application.agente.casos.async_case_post_processing = true;

        // Act
        const behaviors = new Behaviors(data);

        // Assert
        const casos = behaviors.getConfig('agente', 'casos');
        expect(casos.async_case_post_processing).toBe(true);
    });
});

describe('CustomFields validation', () => {
    it('should set default value when a required key is missing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.custom_fields);
        delete data.application.agente.flow_id;

        // Act
        const customFields = new CustomFields(data);

        // Assert
        const agente = customFields.getConfig('agente', 'flow_id');
        expect(data.application.agente.flow_id).toBe('');
    });

    it('should log a warning but not throw when an unexpected key is present', () => {
        // Arrange
        const logWarningSpy = jest.spyOn(Helper, 'logWarning').mockImplementation(() => {});
        const data = structuredClone(SETTINGS.custom_fields);
        data.application.agente.unknown_field = 'bad';

        // Act & Assert
        expect(() => new CustomFields(data)).not.toThrow();
        expect(logWarningSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected keys'));
        logWarningSpy.mockRestore();
    });

    it('should allow empty admin object without throwing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.custom_fields);

        // Act & Assert
        expect(() => new CustomFields(data)).not.toThrow();
        expect(new CustomFields(data).getConfig('admin')).toBeNull();
    });

    it('should accept valid data without throwing', () => {
        // Arrange
        const data = structuredClone(SETTINGS.custom_fields);

        // Act & Assert
        expect(() => new CustomFields(data)).not.toThrow();
    });
});

describe('Layouts clients fields_max_min validation', () => {
    const PATH = 'settings.layouts.application.agente.clients.fields_max_min';
    const layoutsWithLimits = (limits) => {
        const data = structuredClone(SETTINGS.layouts);
        data.application.agente.clients.fields_max_min = limits;
        return data;
    };
    const limitsOf = (layouts) => layouts.getConfig('agente', 'clients').fields_max_min;

    it.each([
        [{}],
        [{ field_documento_min: '', field_documento_max: '' }],
        [{ field_documento_min: 0, field_documento_max: 0 }],
        [{ field_telefono_min: 10, field_telefono_max: 10 }],
        [{ field_telefono_min: '9', field_telefono_max: '10' }],
        [{ field_documento_min: 5, field_documento_max: 0 }],
        [{ field_documento_min: null, field_documento_max: 5 }],
    ])('accepts %p on write', (limits) => {
        expect(() => new Layouts(layoutsWithLimits(limits))).not.toThrow();
    });

    it.each([
        ['field_documento_min', -1],
        ['field_documento_max', '-20'],
        ['field_documento_min', 2.5],
        ['field_documento_max', 'abc'],
    ])('rejects %s=%p on write', (key, value) => {
        expect(() => new Layouts(layoutsWithLimits({ [key]: value }))).toThrow(
            expect.objectContaining({ constructor: ValidationFailError, field: `${PATH}.${key}` })
        );
    });

    it('rejects a max lower than its min on write', () => {
        const data = layoutsWithLimits({ field_telefono_min: 10, field_telefono_max: 5 });
        expect(() => new Layouts(data)).toThrow(
            expect.objectContaining({ constructor: ValidationFailError, field: `${PATH}.field_telefono_max` })
        );
    });

    it('rejects a contradictory pair arriving through a partial update (merge)', () => {
        const layouts = new Layouts(layoutsWithLimits({ field_telefono_min: 10 }));

        expect(() =>
            layouts.merge({ application: { agente: { clients: { fields_max_min: { field_telefono_max: 5 } } } } })
        ).toThrow(ValidationFailError);
        expect(limitsOf(layouts)).toEqual({ field_telefono_min: 10 });
    });

    it('rejects a contradictory pair through a Settings write', () => {
        const settings = structuredClone(SETTINGS);
        settings.layouts.application.agente.clients.fields_max_min = { field_telefono_min: 10, field_telefono_max: 5 };

        expect(() => new Settings(settings)).toThrow(ValidationFailError);
    });

    it('ignores keys that are not char limits', () => {
        const data = layoutsWithLimits({ field_documento_required: -1 });
        expect(() => new Layouts(data)).not.toThrow();
    });

    describe('hydration (strict: false)', () => {
        let logWarningSpy;

        beforeEach(() => {
            logWarningSpy = jest.spyOn(Helper, 'logWarning').mockImplementation(() => {});
        });

        afterEach(() => {
            logWarningSpy.mockRestore();
        });

        it('clears legacy values that never acted as a limit instead of making the configuration unreadable', () => {
            const data = layoutsWithLimits({
                field_documento_min: -1,
                field_documento_max: -1.5,
                field_nombres_min: 'abc',
                field_email_min: 3,
            });

            const layouts = new Layouts(data, { strict: false });

            expect(limitsOf(layouts)).toEqual({
                field_documento_min: '',
                field_documento_max: '',
                field_nombres_min: '',
                field_email_min: 3,
            });
        });

        it.each([
            ['field_documento_min', 2.5, 3],
            ['field_documento_min', '2.1', 3],
            ['field_documento_max', 7.5, 7],
            ['field_documento_max', '7.9', 7],
        ])('keeps the length a legacy decimal %s=%p already enforced (%p)', (key, value, expected) => {
            const layouts = new Layouts(layoutsWithLimits({ [key]: value }), { strict: false });

            expect(limitsOf(layouts)[key]).toBe(expected);
        });

        it('turns a legacy max below 1, which rejected every non-empty value, into no limit (0)', () => {
            const layouts = new Layouts(layoutsWithLimits({ field_documento_max: 0.5 }), { strict: false });

            expect(limitsOf(layouts).field_documento_max).toBe(0);
        });

        it('logs every normalized value as a warning so the change is visible in production', () => {
            new Layouts(layoutsWithLimits({ field_documento_min: -1, field_telefono_max: 7.5 }), { strict: false });

            expect(logWarningSpy).toHaveBeenCalledWith(expect.stringContaining(`${PATH}.field_documento_min`));
            expect(logWarningSpy).toHaveBeenCalledWith(expect.stringContaining(`${PATH}.field_telefono_max`));
        });

        it('clears a legacy max lower than its min and keeps the min', () => {
            const data = layoutsWithLimits({ field_telefono_min: 10, field_telefono_max: 5 });

            const layouts = new Layouts(data, { strict: false });

            expect(limitsOf(layouts)).toEqual({ field_telefono_min: 10, field_telefono_max: '' });
        });

        it('compares a legacy max against the rounded min', () => {
            const data = layoutsWithLimits({ field_telefono_min: 2.5, field_telefono_max: 2 });

            const layouts = new Layouts(data, { strict: false });

            expect(limitsOf(layouts)).toEqual({ field_telefono_min: 3, field_telefono_max: '' });
        });

        it('is applied by Settings when hydrating with strict: false', () => {
            const settings = structuredClone(SETTINGS);
            settings.layouts.application.agente.clients.fields_max_min = {
                field_telefono_min: 10,
                field_telefono_max: 5,
            };

            const hydrated = new Settings(settings, { strict: false });

            expect(hydrated.layouts.getConfig('agente', 'clients').fields_max_min.field_telefono_max).toBe('');
        });

        it('accepts a save after hydrating legacy data (self-heals on the next write)', () => {
            const layouts = new Layouts(layoutsWithLimits({ field_telefono_min: 10, field_telefono_max: 5 }), {
                strict: false,
            });

            expect(() =>
                layouts.merge({ application: { agente: { clients: { show_update_button: false } } } })
            ).not.toThrow();
        });
    });
});
