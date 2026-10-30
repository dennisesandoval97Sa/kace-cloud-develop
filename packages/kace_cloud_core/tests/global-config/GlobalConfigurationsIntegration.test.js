import { v4 as uuidv4 } from 'uuid';

import {
    GlobalConfigCollectionResponse,
    GlobalConfigCounter,
    GlobalConfigCreator,
    GlobalConfigDeleter,
    GlobalConfigFinder,
    GlobalConfigResponse,
    GlobalConfigSearcher,
    GlobalConfigUpdater,
    GlobalConfigurations,
    KnexGlobalConfigurationRepository,
} from '../../src/global-config';
import { knexConfig } from '../knexfile.js';
import { GlobalConfigurationsMother } from './domain/GlobalConfigurationsMother';
import { SETTINGS } from './domain/SettingsMother';
import { StatusEnum } from '../../src/shared';
import { CustomError } from '../../src/shared/errors/CustomError';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { ValidationFailError } from '../../src/shared';

describe('Global configurations Test', () => {
    const repository = new KnexGlobalConfigurationRepository(knexConfig);

    it('creates a new Global Config instance', async () => {
        const dto = GlobalConfigurationsMother.dto();
        const globalConfigCreator = new GlobalConfigCreator(repository);

        await globalConfigCreator.execute(dto);

        const result = await repository.connection('global_configurations').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('should not create a new global config instance when null dto', async () => {
        const globalConfigCreator = new GlobalConfigCreator(repository);

        await expect(globalConfigCreator.execute(null)).rejects.toThrow(Error);
    });

    it('finds an existing Global Configuration instance by id', async () => {
        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
        const globalConfigFinder = new GlobalConfigFinder(repository);

        const globalConfigResult = await globalConfigFinder.execute(globalConfig.id.value);

        expect(globalConfigResult).not.toBeNull();
        expect(globalConfigResult).toBeInstanceOf(GlobalConfigResponse);
    });

    it('return null if not found a record', async () => {
        const globalConfigFinder = new GlobalConfigFinder(repository);

        const globalConfigResult = await globalConfigFinder.execute(uuidv4());

        expect(globalConfigResult).toBeNull();
    });

    it('should throw an error if required parameters are missing in getConfiguration', async () => {
        const globalConfigFinder = new GlobalConfigFinder(repository);

        await expect(globalConfigFinder.getConfiguration(null, 'type', 'application', 'module')).rejects.toThrow(
            'id, type, application, and module are required'
        );
        await expect(globalConfigFinder.getConfiguration('id', null, 'application', 'module')).rejects.toThrow(
            'id, type, application, and module are required'
        );
        await expect(globalConfigFinder.getConfiguration('id', 'type', null, 'module')).rejects.toThrow(
            'id, type, application, and module are required'
        );
        await expect(globalConfigFinder.getConfiguration('id', 'type', 'application', null)).rejects.toThrow(
            'id, type, application, and module are required'
        );
    });

    it('should throw an error if the configuration does not exist', async () => {
        const globalConfigFinder = new GlobalConfigFinder(repository);

        await expect(globalConfigFinder.getConfiguration(uuidv4(), 'type', 'application', 'module')).rejects.toThrow(
            CustomError
        );
    });

    it('should throw an error if module does not exist', async () => {
        const globalConfigFinder = new GlobalConfigFinder(repository);
        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);

        const invalidModule = 'nonExistentModule';
        await expect(
            globalConfigFinder.getConfiguration(globalConfig.id.value, 'behaviors', 'agente', invalidModule)
        ).rejects.toThrow('Settings behaviors in agente with module "nonExistentModule" not found');
    });

    it('updates an existing Config instance', async () => {
        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
        const globalConfigUpdater = new GlobalConfigUpdater(repository);

        const updatedSettings = structuredClone(SETTINGS);
        updatedSettings.layouts.application.agente.header.helps = false;

        const dtoUpdate = {
            settings: updatedSettings,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        await globalConfigUpdater.execute(dtoUpdate, globalConfig.id.value);

        const result = await repository.find(globalConfig.id);
        expect(result).toBeInstanceOf(GlobalConfigurations);
        expect(result.settings.value.layouts.application.agente.header.helps).toBe(
            updatedSettings.layouts.application.agente.header.helps
        );
    });

    it('should return an error when update a non-existent Global Config instance', async () => {
        await GlobalConfigurationsMother.createConfiguration(repository);
        const globalConfigUpdater = new GlobalConfigUpdater(repository);

        await expect(globalConfigUpdater.execute({ status: StatusEnum.ACTIVE.value }, uuidv4())).rejects.toThrow(
            CustomError
        );
    });

    it('should throw an error if required parameters are missing in setConfiguration', async () => {
        const globalConfigUpdater = new GlobalConfigUpdater(repository);
        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);

        await expect(
            globalConfigUpdater.setConfiguration(globalConfig.id.value, null, 'application', 'module', {})
        ).rejects.toThrow('type, application, and module are required');
        await expect(
            globalConfigUpdater.setConfiguration(globalConfig.id.value, 'type', null, 'module', {})
        ).rejects.toThrow('type, application, and module are required');
        await expect(
            globalConfigUpdater.setConfiguration(globalConfig.id.value, 'type', 'application', null, {})
        ).rejects.toThrow('type, application, and module are required');
    });

    it('should throw an error if the configuration for update does not exist', async () => {
        const globalConfigUpdater = new GlobalConfigUpdater(repository);
        const nonExistentId = uuidv4();
        await expect(
            globalConfigUpdater.setConfiguration(nonExistentId, 'type', 'application', 'module', {})
        ).rejects.toThrow(`The global config with id ${nonExistentId} does not exist.`);
    });

    it('should throw an error if settings type is not found', async () => {
        const globalConfigUpdater = new GlobalConfigUpdater(repository);
        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
        const invalidType = 'nonExistentType';

        await expect(
            globalConfigUpdater.setConfiguration(globalConfig.id.value, invalidType, 'application', 'module', {})
        ).rejects.toThrow(`Settings type "${invalidType}" not found`);
    });

    it('should update the settings correctly for valid parameters', async () => {
        const globalConfigUpdater = new GlobalConfigUpdater(repository);

        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);

        const type = 'behaviors';
        const application = 'agente';
        const module = 'geolocation';
        const data = {
            geolocation_login_bool: true,
            geolocation_case_creation_bool: true,
            geolocation_client_search_bool: false,
            geolocation_client_creation_bool: false,
        };

        await globalConfigUpdater.setConfiguration(globalConfig.id.value, type, application, module, data);

        const config = await repository
            .connection('global_configurations')
            .select('*')
            .where('id', globalConfig.id.value)
            .first();
        const updatedSettings = config.settings[type].application[application][module];

        expect(updatedSettings).toEqual(data);
    });

    it('deletes an existing Global Config instance by id', async () => {
        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
        const globalConfigDeleter = new GlobalConfigDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await globalConfigDeleter.execute(globalConfig.id.value, deleteDto);

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'deleted_at', direction: 'asc' },
        };

        const globalConfigSearch = new GlobalConfigSearcher(repository);

        const globalConfigResult = await globalConfigSearch.execute(dtoCriteria);
        const globalConfigResultJson = globalConfigResult.toJson();

        // La semilla deja configuraciones vivas, asi que el listado nunca queda
        // vacio: lo que se comprueba es que la borrada desaparece de el.
        expect(globalConfigResultJson.data.items.map((item) => item.id)).not.toContain(globalConfig.id.value);
    });

    it('should return an error when delete a non-existent State instance', async () => {
        await GlobalConfigurationsMother.createConfiguration(repository);
        const globalConfigDeleter = new GlobalConfigDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await expect(globalConfigDeleter.execute(uuidv4(), deleteDto)).rejects.toThrow(CustomError);
    });

    it('searches for Global config instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await GlobalConfigurationsMother.createRandomConfig(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const globalConfigSearch = new GlobalConfigSearcher(repository);

        const globalConfigResult = await globalConfigSearch.execute(dtoCriteria);

        expect(globalConfigResult).toBeInstanceOf(GlobalConfigCollectionResponse);
    });

    it('returns the filtered total when searching global configurations', async () => {
        await GlobalConfigurationsMother.createConfiguration(repository, {
            description: 'Matching global configuration',
        });
        await GlobalConfigurationsMother.createConfiguration(repository, {
            description: 'Different global configuration',
        });

        const globalConfigResult = await new GlobalConfigSearcher(repository).execute({
            filter: [
                {
                    field: 'global_configurations.description',
                    operator: 'eq',
                    value: 'Matching global configuration',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        });
        const result = globalConfigResult.toJson();

        expect(result.data.items).toHaveLength(1);
        expect(result.metadata.count).toBe(1);
    });

    it('should return an error when not exist field is filtered', async () => {
        for (let i = 0; i < 10; i++) {
            await GlobalConfigurationsMother.createRandomConfig(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'not_exist',
                    operator: 'eq',
                    value: 'value',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        await expect(new GlobalConfigSearcher(repository).execute(dtoCriteria)).rejects.toThrow(QueryDBError);
    });

    it('counts the total number of State instances', async () => {
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const globalConfigCounter = new GlobalConfigCounter(repository);
        // La semilla deja configuraciones en la tabla: se cuenta el incremento.
        const initialCount = Number((await globalConfigCounter.execute(dtoCriteria)).count);

        for (let i = 0; i < 10; i++) {
            await GlobalConfigurationsMother.createRandomConfig(repository);
        }

        const globalConfigResult = await globalConfigCounter.execute(dtoCriteria);

        expect(Number(globalConfigResult.count)).toBe(initialCount + 10);
    });

    it('should return a cero for not found criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await GlobalConfigurationsMother.createRandomConfig(repository);
        }

        const dtoCriteria = {
            // El filtro original comparaba `is_active` (boolean en postgres) con
            // '10' y reventaba el conteo en vez de no encontrar nada.
            filter: [
                {
                    field: 'description',
                    operator: 'eq',
                    value: `sin-coincidencias-${uuidv4()}`,
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const globalConfigCounter = new GlobalConfigCounter(repository);

        const globalConfigResult = await globalConfigCounter.execute(dtoCriteria);

        expect(Number(globalConfigResult.count)).toBe(0);
    });

    it('does not write when only audit columns change (no-op guard)', async () => {
        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
        const globalConfigUpdater = new GlobalConfigUpdater(repository);

        await globalConfigUpdater.execute(
            { updated_at: new Date().toISOString(), updated_by: uuidv4() },
            globalConfig.id.value
        );

        const row = await repository.connection('global_configurations').where('id', globalConfig.id.value).first();
        expect(row.updated_at).toBeNull();
    });

    it('still writes updated_at when a domain field changes', async () => {
        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
        const globalConfigUpdater = new GlobalConfigUpdater(repository);

        await globalConfigUpdater.execute(
            { description: 'updated', updated_at: new Date().toISOString(), updated_by: uuidv4() },
            globalConfig.id.value
        );

        const row = await repository.connection('global_configurations').where('id', globalConfig.id.value).first();
        expect(row.updated_at).not.toBeNull();
        expect(row.description).toBe('updated');
    });

    it('repository.update skips the query when only audit columns changed (defense in depth)', async () => {
        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
        const loaded = await repository.find(globalConfig.id);

        loaded.updated_at = new Date().toISOString();
        loaded.updated_by = uuidv4();
        await repository.update(loaded);

        const row = await repository.connection('global_configurations').where('id', globalConfig.id.value).first();
        expect(row.updated_at).toBeNull();
    });

    it('repository.update applies the query when a domain field changed', async () => {
        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
        const loaded = await repository.find(globalConfig.id);

        loaded.description = 'updated';
        await repository.update(loaded);

        const row = await repository.connection('global_configurations').where('id', globalConfig.id.value).first();
        expect(row.description).toBe('updated');
    });

    it('Reject an creation of Global Config instance with invalid inactivity_time', async () => {
        const invalidSettings = structuredClone(SETTINGS);
        invalidSettings.behaviors.application.admin.users.inactivity_time = 1e31;
        invalidSettings.behaviors.application.admin.users.warning_logout_time = 1e31;

        const dto = {
            description: 'Global Config',
            is_active: true,
            id: 'c8994158-cd39-4256-b9f5-d4ec7cba1c36',
            settings: invalidSettings,
        };

        const globalConfigCreator = new GlobalConfigCreator(repository);

        await expect(globalConfigCreator.execute(dto)).rejects.toThrow(ValidationFailError);
    });

    describe('active_session_limit — GlobalConfigUpdater (merge path)', () => {
        it('rejects a negative active_session_limit and leaves the stored row untouched', async () => {
            const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
            const globalConfigUpdater = new GlobalConfigUpdater(repository);

            const before = await repository
                .connection('global_configurations')
                .where('id', globalConfig.id.value)
                .first();
            const expectedLimit = before.settings.behaviors.application.admin.users.active_session_limit;

            const dtoUpdate = {
                settings: {
                    behaviors: {
                        application: {
                            admin: { users: { active_session_limit: -5 } },
                        },
                    },
                },
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            };

            await expect(globalConfigUpdater.execute(dtoUpdate, globalConfig.id.value)).rejects.toThrow(
                ValidationFailError
            );

            const row = await repository.connection('global_configurations').where('id', globalConfig.id.value).first();
            expect(row.settings.behaviors.application.admin.users.active_session_limit).toBe(expectedLimit);
            expect(row.updated_at).toBeNull();
        });

        it('rejects an active_session_limit greater than 60', async () => {
            const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
            const globalConfigUpdater = new GlobalConfigUpdater(repository);

            const dtoUpdate = {
                settings: {
                    behaviors: {
                        application: {
                            admin: { users: { active_session_limit: 61 } },
                        },
                    },
                },
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            };

            await expect(globalConfigUpdater.execute(dtoUpdate, globalConfig.id.value)).rejects.toThrow(
                ValidationFailError
            );
        });

        it('persists a valid active_session_limit and the configuration remains readable afterwards', async () => {
            const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
            const globalConfigUpdater = new GlobalConfigUpdater(repository);

            const dtoUpdate = {
                settings: {
                    behaviors: {
                        application: {
                            admin: { users: { active_session_limit: 45 } },
                        },
                    },
                },
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            };

            await globalConfigUpdater.execute(dtoUpdate, globalConfig.id.value);

            const globalConfigFinder = new GlobalConfigFinder(repository);
            const found = await globalConfigFinder.execute(globalConfig.id.value);

            expect(found).not.toBeNull();
            expect(found.toJson().data.settings.behaviors.application.admin.users.active_session_limit).toBe(45);
        });
    });
});
