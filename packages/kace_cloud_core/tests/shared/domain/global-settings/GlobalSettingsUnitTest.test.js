import { GlobalSettingsService } from '../../../../src/shared/domain/global-settings/GlobalSettingsService.js';
import { DomainError } from '../../../../src/shared/errors/DomainError';
import { GlobalConfigurationsMother } from '../../../global-config/domain/GlobalConfigurationsMother.js';

describe('GlobalSettingsService Test', () => {
    it('should throw error if GlobalConfigFinder is not provided', () => {
        expect(() => new GlobalSettingsService(null)).toThrow(DomainError);
    });

    it('should load and return settings as object', async () => {
        const dto = GlobalConfigurationsMother.dto();
        const configSettingsFinder = {
            execute: async () => ({ settings: dto.settings }),
        };
        const service = new GlobalSettingsService(configSettingsFinder);
        await service.loadSettings(dto.id);
        expect(service.settings).toEqual(dto.settings);
    });

    it('should parse settings if it is a JSON string', async () => {
        const jsonSettings = JSON.stringify({ app: { test: true } });
        const configSettingsFinder = {
            execute: async () => ({ settings: jsonSettings }),
        };

        const service = new GlobalSettingsService(configSettingsFinder);
        await service.loadSettings('config-id');
        expect(service.settings).toEqual(JSON.parse(jsonSettings));
    });

    it('should throw DomainError if config not found', async () => {
        const configSettingsFinder = {
            execute: async () => null,
        };

        const service = new GlobalSettingsService(configSettingsFinder);
        await expect(service.loadSettings('invalid-id')).rejects.toThrow(DomainError);
    });

    it('should throw DomainError if settings are invalid JSON', async () => {
        const configSettingsFinder = {
            execute: async () => ({ settings: '{invalid json' }),
        };

        const service = new GlobalSettingsService(configSettingsFinder);
        await expect(service.loadSettings('some-id')).rejects.toThrow('Invalid JSON format');
    });

    it('should return value by valid dot path', async () => {
        const dto = GlobalConfigurationsMother.dto();
        const configSettingsFinder = {
            execute: async () => ({ settings: { value: dto.settings } }),
        };

        const service = new GlobalSettingsService(configSettingsFinder);
        await service.loadSettings(dto.id);
        const value = service.getValueByPath('behaviors.application.agente.casos.max_cases_per_user');
        expect(value).toEqual(dto.settings.behaviors.application.agente.casos.max_cases_per_user);
    });

    it('should return null for non-existing path', async () => {
        const dto = GlobalConfigurationsMother.dto();
        const configSettingsFinder = {
            execute: async () => ({ settings: dto.settings }),
        };

        const service = new GlobalSettingsService(configSettingsFinder);
        await service.loadSettings(dto.id);

        const value = service.getValueByPath('non.existing.path');
        expect(value).toBeNull();
    });

    it('should throw error if getValueByPath is called before loading settings', () => {
        const configSettingsFinder = {
            execute: async () => ({}),
        };

        const service = new GlobalSettingsService(configSettingsFinder);
        expect(() => service.getValueByPath('app.key')).toThrow(DomainError);
    });

    it('should throw error if accessing settings before loading', () => {
        const configSettingsFinder = {
            execute: async () => ({}),
        };

        const service = new GlobalSettingsService(configSettingsFinder);
        expect(() => service.settings).toThrow(DomainError);
    });
});
