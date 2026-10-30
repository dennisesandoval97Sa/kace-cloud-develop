import { v4 as uuidV4 } from 'uuid';
import { GlobalConfigCollectionResponse, GlobalConfigResponse, GlobalConfigurations } from '../../src/global-config';
import { GlobalConfigurationsMother } from './domain/GlobalConfigurationsMother';
import { StatusEnum } from '../../src/shared';
import { SETTINGS } from './domain/SettingsMother';
import { DeleteFieldsDoNotExistError, Helper, ValidationFailError } from '../../src/shared/index.js';
import { isCaseStaleCheckEnabled } from '../../src/cases/domain/isCaseStaleCheckEnabled.js';
import { jest } from '@jest/globals';

describe('Global configurations test', () => {
    it('should return a global configurations instance', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = GlobalConfigurations.create(dto);

        expect(globalConfig).toBeInstanceOf(GlobalConfigurations);
        expect(globalConfig.id.value).toEqual(dto.id);
        expect(globalConfig.settings.value).toEqual(dto.settings);
        expect(globalConfig.is_active.value).toEqual(dto.is_active);
        expect(globalConfig.created_at.value).toEqual(dto.created_at);
        expect(globalConfig.created_by.value).toEqual(dto.created_by);
    });

    it('should update a global configuration settings', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);
        const updatedSettings = structuredClone(SETTINGS);
        updatedSettings.layouts.application.agente.header.helps = false;

        const updateDto = {
            settings: updatedSettings,
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };

        globalConfig.update(updateDto);

        expect(globalConfig).toBeInstanceOf(GlobalConfigurations);
        expect(globalConfig.settings.layouts.getConfig('agente', 'header').helps).toEqual(false);
    });

    it('does not update properties when values are the same', () => {
        const dto = GlobalConfigurationsMother.dto();
        const config = GlobalConfigurations.create(dto);

        config.update(dto);

        expect(config.changedAttributes).toEqual({});
    });

    it('marks an config instance as deleted', () => {
        const dto = GlobalConfigurationsMother.dto();
        const config = GlobalConfigurations.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };
        config.delete(deleteDto);

        expect(config.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(config.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('should throw a error if deleted fields are empty', () => {
        const dto = GlobalConfigurationsMother.dto();
        const config = GlobalConfigurations.create(dto);
        const deleteDto = {};

        expect(() => config.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in Global config instance', () => {
        const dto = GlobalConfigurationsMother.dto();
        const config = GlobalConfigurations.create(dto);
        const updateDto = {
            is_active: StatusEnum.INACTIVE.value,
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };
        config.update(updateDto);
        config.flushChanges();

        expect(config.changedAttributes).toEqual({});
    });

    it('hasMeaningfulChanges returns false when only audit columns changed', () => {
        const config = new GlobalConfigurations(GlobalConfigurationsMother.dto());
        config.flushChanges();

        config.updated_at = new Date().toISOString();
        config.updated_by = uuidV4();

        expect(config.hasMeaningfulChanges()).toBe(false);
    });

    it('hasMeaningfulChanges returns true when a domain field changed', () => {
        const config = new GlobalConfigurations(GlobalConfigurationsMother.dto());
        config.flushChanges();

        config.updated_at = new Date().toISOString();
        config.is_active = StatusEnum.INACTIVE.value;

        expect(config.hasMeaningfulChanges()).toBe(true);
    });

    it('hasMeaningfulChanges returns false when there are no pending changes', () => {
        const config = new GlobalConfigurations(GlobalConfigurationsMother.dto());
        config.flushChanges();

        expect(config.hasMeaningfulChanges()).toBe(false);
    });
});

describe('GlobalConfigurations Responses Tests', () => {
    it('converts GlobalConfigurations object to JSON representation', () => {
        const globalConfig = new GlobalConfigurations(GlobalConfigurationsMother.randomDto());
        const globalConfigResponse = new GlobalConfigResponse(globalConfig);

        const json = globalConfigResponse.toJson();

        expect(json).toEqual({
            data: {
                id: globalConfig.id.value,
                description: globalConfig.description.value,
                settings: globalConfig.settings.value,
                is_active: globalConfig.is_active.value,
                created_at: globalConfig.created_at.value,
                updated_at: globalConfig.updated_at.value,
                created_by: globalConfig.created_by.value,
                updated_by: globalConfig.updated_by.value,
                deleted_at: globalConfig.deleted_at.value,
                deleted_by: globalConfig.deleted_by.value,
            },
        });
    });

    it('converts GlobalConfigurations collection object to JSON representation', () => {
        const globalConfig = [
            new GlobalConfigurations(GlobalConfigurationsMother.randomDto()),
            new GlobalConfigurations(GlobalConfigurationsMother.randomDto()),
        ];
        const globalConfigCollectionResponse = new GlobalConfigCollectionResponse(globalConfig, globalConfig.length);

        const json = globalConfigCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: globalConfig.map((globalConfig) => new GlobalConfigResponse(globalConfig).toJson().data),
            },
            metadata: {
                count: globalConfig.length,
            },
        });
    });

    it('return an empty object if Global config is null', () => {
        const globalConfigResponse = new GlobalConfigResponse(null);

        const json = globalConfigResponse.toJson();

        expect(json).toMatchObject({});
    });
});

describe('GlobalConfigurations Partial Update', () => {
    it('updating a single nested field should change only that field and leave all siblings and unrelated sections untouched', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);

        const beforeHeader = structuredClone(globalConfig.settings.layouts.getConfig('agente', 'header'));
        const beforeAgentModule = structuredClone(globalConfig.settings.layouts.getConfig('agente', 'agent'));
        const beforeBehaviors = JSON.stringify(globalConfig.settings.behaviors.configurations);
        const beforeCustomFields = JSON.stringify(globalConfig.settings.customFields.configurations);

        globalConfig.update({
            settings: {
                layouts: {
                    application: {
                        agente: {
                            header: { helps: false, search_clients: false },
                        },
                    },
                },
            },
        });

        expect(globalConfig.settings.layouts.getConfig('agente', 'header').helps).toBe(false);
        expect(globalConfig.settings.layouts.getConfig('agente', 'header').search_clients).toBe(false);

        expect(globalConfig.settings.layouts.getConfig('agente', 'header').custom_logo).toBe(beforeHeader.custom_logo);
        expect(globalConfig.settings.layouts.getConfig('agente', 'header').high_impact_fields).toBe(
            beforeHeader.high_impact_fields
        );

        expect(globalConfig.settings.layouts.getConfig('agente', 'agent')).toEqual(beforeAgentModule);

        expect(JSON.stringify(globalConfig.settings.behaviors.configurations)).toBe(beforeBehaviors);
        expect(JSON.stringify(globalConfig.settings.customFields.configurations)).toBe(beforeCustomFields);
    });

    it('updating multiple sections at once should change exactly those fields and leave all other siblings untouched', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);

        const beforeHeaderHelps = globalConfig.settings.layouts.getConfig('agente', 'header').helps;
        const beforeHeaderCustomLogo = globalConfig.settings.layouts.getConfig('agente', 'header').custom_logo;
        const beforeAdminLayouts = JSON.stringify(globalConfig.settings.layouts.getConfig('admin', 'cases'));
        const beforeCasos = structuredClone(globalConfig.settings.behaviors.configurations.application.agente.casos);
        const beforeAdminBehaviors = JSON.stringify(globalConfig.settings.behaviors.configurations.application.admin);
        const beforeCustomFields = JSON.stringify(globalConfig.settings.customFields.configurations);

        globalConfig.update({
            settings: {
                layouts: {
                    application: {
                        agente: { header: { search_clients: false } },
                    },
                },
                behaviors: {
                    application: {
                        agente: { casos: { folio_length: 7 } },
                    },
                },
            },
        });

        expect(globalConfig.settings.layouts.getConfig('agente', 'header').search_clients).toBe(false);
        expect(globalConfig.settings.behaviors.configurations.application.agente.casos.folio_length).toBe(7);

        expect(globalConfig.settings.layouts.getConfig('agente', 'header').helps).toBe(beforeHeaderHelps);
        expect(globalConfig.settings.layouts.getConfig('agente', 'header').custom_logo).toBe(beforeHeaderCustomLogo);
        expect(globalConfig.settings.behaviors.configurations.application.agente.casos.assign_strategy).toBe(
            beforeCasos.assign_strategy
        );
        expect(globalConfig.settings.behaviors.configurations.application.agente.casos.order_type).toBe(
            beforeCasos.order_type
        );

        expect(JSON.stringify(globalConfig.settings.layouts.getConfig('admin', 'cases'))).toBe(beforeAdminLayouts);
        expect(JSON.stringify(globalConfig.settings.behaviors.configurations.application.admin)).toBe(
            beforeAdminBehaviors
        );
        expect(JSON.stringify(globalConfig.settings.customFields.configurations)).toBe(beforeCustomFields);
    });

    it('should mark settings as changed only when the update actually differs from the current state', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);
        globalConfig.flushChanges();

        const currentInactivityTime =
            globalConfig.settings.behaviors.configurations.application.admin.users.inactivity_time;

        globalConfig.update({
            settings: { behaviors: { application: { admin: { users: { inactivity_time: currentInactivityTime } } } } },
        });
        expect(globalConfig.changedAttributes.settings).toBeUndefined();

        globalConfig.update({
            settings: {
                behaviors: { application: { admin: { users: { inactivity_time: currentInactivityTime + 1 } } } },
            },
        });
        expect(globalConfig.changedAttributes.settings).toBeDefined();
        const recorded = JSON.parse(globalConfig.changedAttributes.settings);
        expect(recorded.behaviors.application.admin.users.inactivity_time).toBe(currentInactivityTime + 1);
    });

    it('should not change anything when updating with an empty settings object', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);
        const originalSettings = JSON.stringify(globalConfig.settings.value);

        globalConfig.update({ settings: {} });

        expect(JSON.stringify(globalConfig.settings.value)).toBe(originalSettings);
    });

    it('should preserve work_queue_sorting_rules when updating adjacent case settings', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);

        const initialRules = [
            {
                assign_strategy: 'sla_due_date',
                order_type: 'ASC NULLS FIRST',
                cast_type: 'date',
            },
            {
                assign_strategy: 'created_at',
                order_type: 'DESC NULLS LAST',
            },
        ];

        globalConfig.update({
            settings: {
                behaviors: {
                    application: {
                        agente: {
                            casos: {
                                work_queue_sorting_rules: initialRules,
                            },
                        },
                    },
                },
            },
        });

        globalConfig.flushChanges();

        globalConfig.update({
            settings: {
                behaviors: {
                    application: {
                        agente: {
                            casos: {
                                folio_length: 9,
                            },
                        },
                    },
                },
            },
        });

        expect(
            globalConfig.settings.behaviors.configurations.application.agente.casos.work_queue_sorting_rules
        ).toEqual(initialRules);
        expect(globalConfig.settings.behaviors.configurations.application.agente.casos.folio_length).toBe(9);
    });

    it('should persist show_aux_client_expanded and hide_client_form in layouts clients', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);

        globalConfig.update({
            settings: {
                layouts: {
                    application: {
                        agente: {
                            clients: {
                                show_aux_client_expanded: true,
                                hide_client_form: true,
                            },
                        },
                    },
                },
            },
        });

        const clients = globalConfig.settings.layouts.getConfig('agente', 'clients');
        expect(clients.show_aux_client_expanded).toBe(true);
        expect(clients.hide_client_form).toBe(true);
    });

    it('should persist notifications settings in layouts cases when show_notifications is true', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);

        globalConfig.update({
            settings: {
                layouts: {
                    application: {
                        agente: {
                            cases: {
                                show_notifications: true,
                                notifications_one_script_form: 'form-uuid',
                                refresh_tab_notifications: true,
                            },
                        },
                    },
                },
            },
        });

        const cases = globalConfig.settings.layouts.getConfig('agente', 'cases');
        expect(cases.show_notifications).toBe(true);
        expect(cases.notifications_one_script_form).toBe('form-uuid');
        expect(cases.refresh_tab_notifications).toBe(true);
    });

    it('should clear notifications_one_script_form when show_notifications is false on update', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);

        globalConfig.update({
            settings: {
                layouts: {
                    application: {
                        agente: {
                            cases: {
                                show_notifications: false,
                                notifications_one_script_form: 'form-uuid',
                            },
                        },
                    },
                },
            },
        });

        const cases = globalConfig.settings.layouts.getConfig('agente', 'cases');
        expect(cases.show_notifications).toBe(false);
        expect(cases.notifications_one_script_form).toBe('');
    });

    it('should log an error but not throw when a partial update introduces unexpected keys', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);

        expect(() =>
            globalConfig.update({
                settings: {
                    behaviors: {
                        application: {
                            agente: {
                                folio_length: 99,
                                casos: {
                                    invalid_garbage_key: 'this should not be here',
                                },
                            },
                        },
                    },
                },
            })
        ).not.toThrow();
    });
});

describe('Behaviors — transition_stale_check', () => {
    it('defaults to false when not present in the stored settings', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);

        const casos = globalConfig.settings.behaviors.getConfig('agente', 'casos');

        expect(casos.transition_stale_check).toBe(false);
    });

    it('can be set to true and read back via getConfig', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);

        globalConfig.update({
            settings: {
                behaviors: {
                    application: {
                        agente: { casos: { transition_stale_check: true } },
                    },
                },
            },
        });

        expect(globalConfig.settings.behaviors.getConfig('agente', 'casos').transition_stale_check).toBe(true);
    });

    it('updating transition_stale_check does not affect sibling caso fields', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);
        const before = structuredClone(globalConfig.settings.behaviors.getConfig('agente', 'casos'));

        globalConfig.update({
            settings: {
                behaviors: {
                    application: {
                        agente: { casos: { transition_stale_check: true } },
                    },
                },
            },
        });

        const after = globalConfig.settings.behaviors.getConfig('agente', 'casos');
        expect(after.folio_length).toBe(before.folio_length);
        expect(after.assign_strategy).toBe(before.assign_strategy);
        expect(after.case_require_state_change).toBe(before.case_require_state_change);
    });
});

describe('Behaviors — active_session_limit', () => {
    const updateActiveSessionLimit = (globalConfig, active_session_limit) =>
        globalConfig.update({
            settings: {
                behaviors: {
                    application: {
                        admin: { users: { active_session_limit } },
                    },
                },
            },
        });

    it('rejects a negative active_session_limit on initial creation', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        dto.settings.behaviors.application.admin.users.active_session_limit = -5;

        expect(() => new GlobalConfigurations(dto)).toThrow(ValidationFailError);
    });

    it('rejects a negative active_session_limit via a partial update (merge path)', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        const globalConfig = new GlobalConfigurations(dto);

        expect(() => updateActiveSessionLimit(globalConfig, -5)).toThrow(ValidationFailError);
    });

    it('leaves the in-memory aggregate untouched when a partial update is rejected', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        const globalConfig = new GlobalConfigurations(dto);
        const before = globalConfig.settings.behaviors.getConfig('admin', 'users').active_session_limit;

        expect(() => updateActiveSessionLimit(globalConfig, -5)).toThrow(ValidationFailError);

        expect(globalConfig.settings.behaviors.getConfig('admin', 'users').active_session_limit).toBe(before);
    });

    it('rejects an active_session_limit greater than 60 via a partial update', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        const globalConfig = new GlobalConfigurations(dto);

        expect(() => updateActiveSessionLimit(globalConfig, 61)).toThrow(ValidationFailError);
    });

    it.each([['abc'], [''], [true]])(
        'rejects a non-numeric active_session_limit (%p) via a partial update',
        (value) => {
            const dto = structuredClone(GlobalConfigurationsMother.dto());
            const globalConfig = new GlobalConfigurations(dto);

            expect(() => updateActiveSessionLimit(globalConfig, value)).toThrow(ValidationFailError);
        }
    );

    it('rejects a non-integer active_session_limit via a partial update', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        const globalConfig = new GlobalConfigurations(dto);

        expect(() => updateActiveSessionLimit(globalConfig, 1.5)).toThrow(ValidationFailError);
    });

    it('accepts a valid active_session_limit via a partial update', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        const globalConfig = new GlobalConfigurations(dto);

        globalConfig.update({
            settings: {
                behaviors: {
                    application: {
                        admin: { users: { active_session_limit: 30 } },
                    },
                },
            },
        });

        expect(globalConfig.settings.behaviors.getConfig('admin', 'users').active_session_limit).toBe(30);
    });

    it.each([[-5], [61], [1.5], [''], ['abc'], [true]])(
        'normalizes a legacy invalid stored active_session_limit (%p) instead of throwing on hydration',
        (storedValue) => {
            const dto = structuredClone(GlobalConfigurationsMother.dto());
            dto.settings.behaviors.application.admin.users.active_session_limit = storedValue;

            const globalConfig = new GlobalConfigurations(dto, { strict: false });

            expect(globalConfig.settings.behaviors.getConfig('admin', 'users').active_session_limit).toBe(2);
        }
    );

    it('still rejects a legacy invalid value on the strict (write) path', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        dto.settings.behaviors.application.admin.users.active_session_limit = 999;

        expect(() => new GlobalConfigurations(dto)).toThrow(ValidationFailError);
    });
});

describe('Behaviors — inactivity_time / warning_logout_time', () => {
    const updateUsers = (globalConfig, users) =>
        globalConfig.update({
            settings: {
                behaviors: {
                    application: {
                        admin: { users },
                    },
                },
            },
        });

    it('rejects an inactivity_time greater than 480 via a partial update (merge path)', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        const globalConfig = new GlobalConfigurations(dto);

        expect(() => updateUsers(globalConfig, { inactivity_time: 481 })).toThrow(ValidationFailError);
    });

    it('rejects an inactivity_time lower than 1 via a partial update (merge path)', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        const globalConfig = new GlobalConfigurations(dto);

        expect(() => updateUsers(globalConfig, { inactivity_time: 0 })).toThrow(ValidationFailError);
    });

    it('leaves the in-memory aggregate untouched when an out-of-range inactivity_time update is rejected', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        const globalConfig = new GlobalConfigurations(dto);
        const before = globalConfig.settings.behaviors.getConfig('admin', 'users').inactivity_time;

        expect(() => updateUsers(globalConfig, { inactivity_time: 9999 })).toThrow(ValidationFailError);

        expect(globalConfig.settings.behaviors.getConfig('admin', 'users').inactivity_time).toBe(before);
    });

    it('rejects a warning_logout_time greater than 60 via a partial update', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        const globalConfig = new GlobalConfigurations(dto);

        expect(() => updateUsers(globalConfig, { warning_logout_time: 61 })).toThrow(ValidationFailError);
    });

    it('rejects a warning_logout_time greater than or equal to inactivity_time via a partial update', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        const globalConfig = new GlobalConfigurations(dto);

        expect(() => updateUsers(globalConfig, { inactivity_time: 30, warning_logout_time: 30 })).toThrow(
            ValidationFailError
        );
    });

    it('accepts warning_logout_time of 0 (disabled) even when inactivity_time is small', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        const globalConfig = new GlobalConfigurations(dto);

        updateUsers(globalConfig, { inactivity_time: 1, warning_logout_time: 0 });

        expect(globalConfig.settings.behaviors.getConfig('admin', 'users').inactivity_time).toBe(1);
        expect(globalConfig.settings.behaviors.getConfig('admin', 'users').warning_logout_time).toBe(0);
    });

    it('normalizes a legacy invalid stored inactivity_time instead of throwing on hydration', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        dto.settings.behaviors.application.admin.users.inactivity_time = 9999;

        const globalConfig = new GlobalConfigurations(dto, { strict: false });

        expect(globalConfig.settings.behaviors.getConfig('admin', 'users').inactivity_time).toBe(120);
    });

    it('normalizes a legacy stored warning_logout_time >= inactivity_time to 0 instead of throwing on hydration', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        dto.settings.behaviors.application.admin.users.inactivity_time = 30;
        dto.settings.behaviors.application.admin.users.warning_logout_time = 30;

        const globalConfig = new GlobalConfigurations(dto, { strict: false });

        expect(globalConfig.settings.behaviors.getConfig('admin', 'users').warning_logout_time).toBe(0);
    });

    it('still rejects a legacy invalid inactivity_time on the strict (write) path', () => {
        const dto = structuredClone(GlobalConfigurationsMother.dto());
        dto.settings.behaviors.application.admin.users.inactivity_time = 9999;

        expect(() => new GlobalConfigurations(dto)).toThrow(ValidationFailError);
    });
});

describe('Behaviors — responsable_stale_check', () => {
    it('defaults to false when not present in the stored settings', () => {
        const settings = structuredClone(SETTINGS);
        delete settings.behaviors.application.agente.casos.responsable_stale_check;
        const dto = GlobalConfigurationsMother.dto({ settings });
        const globalConfig = new GlobalConfigurations(dto);

        const casos = globalConfig.settings.behaviors.getConfig('agente', 'casos');

        expect(casos.responsable_stale_check).toBe(false);
    });

    it('can be set to true and read back via getConfig', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);

        globalConfig.update({
            settings: {
                behaviors: {
                    application: {
                        agente: { casos: { responsable_stale_check: true } },
                    },
                },
            },
        });

        expect(globalConfig.settings.behaviors.getConfig('agente', 'casos').responsable_stale_check).toBe(true);
    });

    it('updating responsable_stale_check does not affect sibling caso fields', () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfig = new GlobalConfigurations(dto);
        const before = structuredClone(globalConfig.settings.behaviors.getConfig('agente', 'casos'));

        globalConfig.update({
            settings: {
                behaviors: {
                    application: {
                        agente: { casos: { responsable_stale_check: true } },
                    },
                },
            },
        });

        const after = globalConfig.settings.behaviors.getConfig('agente', 'casos');
        expect(after.folio_length).toBe(before.folio_length);
        expect(after.assign_strategy).toBe(before.assign_strategy);
        expect(after.transition_stale_check).toBe(before.transition_stale_check);
    });
});

describe('Behaviors — case_stale_check', () => {
    it('preserves absence so legacy transition_stale_check still enables the helper after hydrate', () => {
        const settings = structuredClone(SETTINGS);
        delete settings.behaviors.application.agente.casos.case_stale_check;
        settings.behaviors.application.agente.casos.transition_stale_check = true;
        const dto = GlobalConfigurationsMother.dto({ settings });
        const globalConfig = new GlobalConfigurations(dto);

        const casos = globalConfig.settings.behaviors.getConfig('agente', 'casos');

        expect(casos.case_stale_check).toBeNull();
        expect(isCaseStaleCheckEnabled(casos)).toBe(true);
    });

    it('keeps explicit false so legacy flags do not OR after hydrate', () => {
        const settings = structuredClone(SETTINGS);
        settings.behaviors.application.agente.casos.case_stale_check = false;
        settings.behaviors.application.agente.casos.transition_stale_check = true;
        const dto = GlobalConfigurationsMother.dto({ settings });
        const globalConfig = new GlobalConfigurations(dto);

        const casos = globalConfig.settings.behaviors.getConfig('agente', 'casos');

        expect(Object.prototype.hasOwnProperty.call(casos, 'case_stale_check')).toBe(true);
        expect(casos.case_stale_check).toBe(false);
        expect(isCaseStaleCheckEnabled(casos)).toBe(false);
    });

    it('defaults helper to false when case_stale_check is omitted and legacy flags are off', () => {
        const settings = structuredClone(SETTINGS);
        delete settings.behaviors.application.agente.casos.case_stale_check;
        settings.behaviors.application.agente.casos.transition_stale_check = false;
        settings.behaviors.application.agente.casos.responsable_stale_check = false;
        const dto = GlobalConfigurationsMother.dto({ settings });
        const globalConfig = new GlobalConfigurations(dto);

        const casos = globalConfig.settings.behaviors.getConfig('agente', 'casos');

        expect(casos.case_stale_check).toBeNull();
        expect(isCaseStaleCheckEnabled(casos)).toBe(false);
    });

    it('does not mutate EXPECTED_STRUCTURE when incomplete tree fill then deletes case_stale_check', () => {
        const incomplete = structuredClone(SETTINGS);
        delete incomplete.behaviors.application.agente.casos;
        new GlobalConfigurations(GlobalConfigurationsMother.dto({ settings: incomplete }));

        const omitAfterIncomplete = structuredClone(SETTINGS);
        delete omitAfterIncomplete.behaviors.application.agente.casos.case_stale_check;
        omitAfterIncomplete.behaviors.application.agente.casos.transition_stale_check = true;
        const omitConfig = new GlobalConfigurations(GlobalConfigurationsMother.dto({ settings: omitAfterIncomplete }));
        const omitCasos = omitConfig.settings.behaviors.getConfig('agente', 'casos');
        expect(omitCasos.case_stale_check).toBeNull();
        expect(isCaseStaleCheckEnabled(omitCasos)).toBe(true);

        const logErrorSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        const withFlag = structuredClone(SETTINGS);
        withFlag.behaviors.application.agente.casos.case_stale_check = true;
        const secondConfig = new GlobalConfigurations(GlobalConfigurationsMother.dto({ settings: withFlag }));

        const unexpectedCalls = logErrorSpy.mock.calls.filter(
            ([message]) => typeof message === 'string' && message.includes('case_stale_check')
        );
        expect(unexpectedCalls).toEqual([]);
        logErrorSpy.mockRestore();

        expect(isCaseStaleCheckEnabled(secondConfig.settings.behaviors.getConfig('agente', 'casos'))).toBe(true);
    });
});
