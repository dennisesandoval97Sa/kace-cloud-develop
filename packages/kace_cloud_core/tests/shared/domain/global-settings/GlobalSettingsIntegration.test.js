import { v4 as uuidv4 } from 'uuid';
import { GlobalSettingsService } from '../../../../src/shared/domain/global-settings/GlobalSettingsService.js';
import { GlobalConfigFinder } from '../../../../src/global-config/domain/GlobalConfigFinder.js';
import { KnexGlobalConfigurationRepository } from '../../../../src/global-config/index.js';
import { knexConfig } from '../../../knexfile.js';
import { GlobalConfigurationsMother } from '../../../global-config/domain/GlobalConfigurationsMother.js';

describe('GlobalSettingsService Integration Tests', () => {
    const repository = new KnexGlobalConfigurationRepository(knexConfig);
    let globalSettingsService;

    beforeEach(async () => {
        const globalConfigFinder = new GlobalConfigFinder(repository);
        globalSettingsService = new GlobalSettingsService(globalConfigFinder);
    });

    describe('loadSettings', () => {
        it('should load settings successfully from the database', async () => {
            const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);

            await globalSettingsService.loadSettings(globalConfig.id.value);
            const settings = globalSettingsService.settings;

            expect(settings.value).not.toBeNull();
            expect(settings.value).toHaveProperty('layouts');
            expect(settings.value).toHaveProperty('behaviors');
            expect(settings.value).toHaveProperty('custom_fields');
        });

        it('should throw an error if the configuration does not exist', async () => {
            const nonExistentId = uuidv4();

            await expect(globalSettingsService.loadSettings(nonExistentId)).rejects.toThrow(
                `Configuration with ID ${nonExistentId} not found or settings are missing`
            );
        });

        it('should throw an error if settings are accessed before loading', () => {
            expect(() => globalSettingsService.settings).toThrow(
                'Settings have not been loaded. Call loadSettings() first.'
            );
        });
    });

    describe('getValueByPath', () => {
        it('should retrieve a specific value from the loaded settings', async () => {
            const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
            await globalSettingsService.loadSettings(globalConfig.id.value);

            // El ajuste dejo de vivir en `agente.asignacion`: hoy es
            // `agente.casos.type_assignment`, con el mismo valor.
            const value = globalSettingsService.getValueByPath('behaviors.application.agente.casos.type_assignment');

            expect(value).toBe('cola_de_trabajo');
        });

        it('should return null for a non-existent path in the settings', async () => {
            const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);
            await globalSettingsService.loadSettings(globalConfig.id.value);

            const value = globalSettingsService.getValueByPath('layouts.application.admin.clients.nonExistentKey');

            expect(value).toBeNull();
        });
    });
});
