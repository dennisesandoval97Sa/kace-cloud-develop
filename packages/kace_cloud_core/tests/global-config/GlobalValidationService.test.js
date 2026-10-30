import { GlobalValidationService, KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import { GlobalConfigurationsMother } from './domain/GlobalConfigurationsMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import { knexConfig } from '../knexfile.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { User } from '../../src/users/index.js';
import UsersMother from '../users/domain/UsersMother.js';
import { SETTINGS } from './domain/SettingsMother.js';

describe('GlobalValidationService Integration Tests', () => {
    const globalConfigRepository = new KnexGlobalConfigurationRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(globalConfigRepository.connection);
    const globalValidationService = new GlobalValidationService(groupsRepository, globalConfigRepository);
    let testGroup;

    beforeEach(async () => {
        const settings = structuredClone(SETTINGS);
        settings.layouts.application.agente.clients.fields_required = {
            field_nombres_required: true,
            field_email_required: true,
            field_telefono_required: false,
        };
        settings.layouts.application.agente.clients.fields_max_min = {
            field_nombres_min: 2,
            field_nombres_max: 100,
            field_email_min: 5,
            field_email_max: 200,
            field_telefono_min: 7,
            field_telefono_max: 15,
        };
        // La configuracion se crea ANTES que el grupo, no despues. El orden
        // inverso insertaba dos veces la misma fila de `global_configurations`:
        // `GroupsMother.ensureRelations` ya respalda `configuration_id` con una
        // fila minima -solo el id, sin `settings`- y el insert de aqui chocaba
        // con ella (`global_configurations_pkey`). Creandola primero con los
        // `settings` que estos tests necesitan, el `ensureParentRow` de la
        // factoria la encuentra y no hace nada: es idempotente.
        const configuration = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
            settings,
        });

        testGroup = await GroupsMother.createRandomGroup(groupsRepository, null, {
            configuration_id: configuration.id.value,
        });
    });

    describe('validateFields', () => {
        const mockUser = (groupId) =>
            new User({
                ...UsersMother.dto(),
                grupo_activo: groupId,
            });

        it('should pass validation when all required fields are present and valid', async () => {
            const user = mockUser(testGroup.id.value);
            const payload = {
                nombres: 'John Doe',
                email: 'john@example.com',
            };

            const result = await globalValidationService.validateFields(user, 'agente', 'clients', payload);
            expect(result.hasErrors()).toBe(false);
        });

        it('should return errors when required fields are missing', async () => {
            const user = mockUser(testGroup.id.value);
            const payload = {
                nombres: 'John Doe',
            };

            const result = await globalValidationService.validateFields(user, 'agente', 'clients', payload);
            expect(result.hasErrors()).toBe(true);
            expect(result.toJSON()).toEqual({
                email: '"email" is required',
            });
        });

        it('should validate length for non-required fields when present', async () => {
            const user = mockUser(testGroup.id.value);
            const payload = {
                nombres: 'John Doe',
                email: 'john@example.com',
                telefono: '123',
            };

            const result = await globalValidationService.validateFields(user, 'agente', 'clients', payload);
            expect(result.hasErrors()).toBe(true);
            expect(result.toJSON()).toEqual({
                telefono: '"telefono" length must be at least 7 characters long',
            });
        });

        it('should consider empty string as missing value for required fields', async () => {
            const user = mockUser(testGroup.id.value);
            const payload = {
                nombres: 'John Doe',
                email: '',
            };

            const result = await globalValidationService.validateFields(user, 'agente', 'clients', payload);
            expect(result.hasErrors()).toBe(true);
            expect(result.toJSON()).toEqual({
                email: '"email" is required',
            });
        });

        it('should ignore fields not in payload', async () => {
            const user = mockUser(testGroup.id.value);
            const payload = {
                nombres: 'John Doe',
                email: 'john@example.com',
            };

            const result = await globalValidationService.validateFields(user, 'agente', 'clients', payload);
            expect(result.hasErrors()).toBe(false);
        });

        it('should collect errors for multiple validation failures', async () => {
            const user = mockUser(testGroup.id.value);
            const payload = {
                nombres: 'J',
                email: 'invalid',
            };

            const result = await globalValidationService.validateFields(user, 'agente', 'clients', payload);
            expect(result.hasErrors()).toBe(true);
            expect(result.toJSON()).toEqual({
                nombres: '"nombres" length must be at least 2 characters long',
            });
        });

        it('should return no errors when configuration has no validation rules', async () => {
            const settingsNoRules = structuredClone(SETTINGS);
            settingsNoRules.layouts.application.agente.clients.fields_required = {};
            settingsNoRules.layouts.application.agente.clients.fields_max_min = {};
            // Mismo orden que en el beforeEach: primero la configuracion, luego
            // el grupo que apunta a ella. Al reves se insertaba dos veces la
            // misma fila de `global_configurations`.
            const configuration = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
                settings: settingsNoRules,
            });

            const groupWithConfig = await GroupsMother.createRandomGroup(groupsRepository, null, {
                configuration_id: configuration.id.value,
            });

            const user = mockUser(groupWithConfig.id.value);
            const result = await globalValidationService.validateFields(user, 'agente', 'clients', {});
            expect(result.hasErrors()).toBe(false);
        });

        it('ignores a legacy max lower than its min instead of rejecting every value', async () => {
            const configuration = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
                settings: structuredClone(SETTINGS),
            });
            // Stored before the write path validated the pair, so it bypasses the aggregate
            const legacySettings = structuredClone(SETTINGS);
            legacySettings.layouts.application.agente.clients.fields_max_min = {
                field_telefono_min: 10,
                field_telefono_max: 5,
            };
            await globalConfigRepository
                .table()
                .where({ id: configuration.id.value })
                .update({ settings: legacySettings });
            const groupWithConfig = await GroupsMother.createRandomGroup(groupsRepository, null, {
                configuration_id: configuration.id.value,
            });

            const user = mockUser(groupWithConfig.id.value);
            const validTelefono = await globalValidationService.validateFields(user, 'agente', 'clients', {
                telefono: '3001234567',
            });
            const shortTelefono = await globalValidationService.validateFields(user, 'agente', 'clients', {
                telefono: '300',
            });

            expect(validTelefono.toJSON().telefono).toBeUndefined();
            expect(shortTelefono.toJSON().telefono).toBe('"telefono" length must be at least 10 characters long');
        });
    });
});
