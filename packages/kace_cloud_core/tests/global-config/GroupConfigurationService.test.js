import {
    KnexGlobalConfigurationRepository,
    GroupConfigService,
    GlobalConfigurations,
} from '../../src/global-config/index.js';
import { GlobalConfigurationsMother } from './domain/GlobalConfigurationsMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import { knexConfig } from '../knexfile.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { User } from '../../src/users/index.js';
import UsersMother from '../users/domain/UsersMother.js';
import { v4 as uuidV4 } from 'uuid';
import { CustomError } from '../../src/shared/index.js';

describe('GlobalValidationService Integration Tests', () => {
    const globalConfigRepository = new KnexGlobalConfigurationRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(globalConfigRepository.connection);
    const groupConfigService = new GroupConfigService(groupsRepository, globalConfigRepository);

    let testGroup;

    beforeEach(async () => {
        // La configuracion se crea ANTES que el grupo, no despues. El orden
        // inverso insertaba dos veces la misma fila de `global_configurations`:
        // `GroupsMother.ensureRelations` ya respalda `configuration_id` con una
        // fila minima -solo el id, sin `settings`- y el insert de aqui chocaba
        // con ella (`global_configurations_pkey`). Quitar este insert no vale:
        // la fila minima de la factoria no lleva `settings`, y estos tests
        // esperan una configuracion completa.
        const configuration = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository);

        testGroup = await GroupsMother.createRandomGroup(groupsRepository, null, {
            configuration_id: configuration.id.value,
        });
    });

    const mockUser = (groupId) =>
        new User({
            ...UsersMother.dto(),
            grupo_activo: groupId,
        });

    it('should return configuration for valid user with active group', async () => {
        const user = mockUser(testGroup.id.value);

        const config = await groupConfigService.execute(user);

        expect(config).toBeDefined();
        expect(config).toBeInstanceOf(GlobalConfigurations);
    });

    it('should throw error if user is null', async () => {
        await expect(groupConfigService.execute(null)).rejects.toThrow(CustomError);
        await expect(groupConfigService.execute(null)).rejects.toThrow('User must be provided');
    });

    it('should throw error if user has no active group', async () => {
        const user = new User({ ...UsersMother.dto(), grupo_activo: null });

        await expect(groupConfigService.execute(user)).rejects.toThrow(CustomError);
        await expect(groupConfigService.execute(user)).rejects.toThrow('User has no active group assigned');
    });

    it('should throw error if group does not exist', async () => {
        const nonExistentGroupId = uuidV4();
        const user = mockUser(nonExistentGroupId);

        await expect(groupConfigService.execute(user)).rejects.toThrow(CustomError);
        await expect(groupConfigService.execute(user)).rejects.toThrow('Active group not found');
    });

    it('should throw error if group has no configuration assigned', async () => {
        await groupsRepository
            .connection(groupsRepository.tableName)
            .update({ configuration_id: null })
            .where({ id: testGroup.id.value });

        const user = mockUser(testGroup.id.value);

        await expect(groupConfigService.execute(user)).rejects.toThrow(CustomError);
        await expect(groupConfigService.execute(user)).rejects.toThrow('Group has no configuration assigned');
    });

    it('should throw error if configuration does not exist', async () => {
        const group = await GroupsMother.createRandomGroup(groupsRepository);

        // Borrado logico, no fisico. `grupos_configuration_id_foreign` es
        // ON DELETE SET NULL, asi que un DELETE de verdad deja el grupo con
        // `configuration_id` a null y el servicio responde 'Group has no
        // configuration assigned', que es otra rama. El estado que este test
        // quiere -grupo apuntando a una configuracion que el finder no
        // encuentra- solo se alcanza con `deleted_at`, que es justo lo que
        // filtra `KnexGlobalConfigurationRepository.find`.
        await globalConfigRepository
            .connection('global_configurations')
            .where({ id: group.configuration_id.value })
            .update({ deleted_at: new Date() });

        const user = mockUser(group.id.value);

        await expect(groupConfigService.execute(user)).rejects.toThrow(CustomError);
        await expect(groupConfigService.execute(user)).rejects.toThrow('Group configuration not found');
    });
});
