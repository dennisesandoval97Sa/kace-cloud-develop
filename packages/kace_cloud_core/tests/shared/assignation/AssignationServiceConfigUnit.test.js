import { jest } from '@jest/globals';
import { AssignationService } from '../../../src/shared/assignation/AssignationService.js';
import { WorkQueueService } from '../../../src/shared/assignation/WorkQueueService.js';
import { StatusEnum } from '../../../src/shared/domain/enum/StatusEnum.js';

const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const CONFIG_ID = '22222222-2222-4222-8222-222222222222';

const makeGroup = (id, configurationId) => ({
    id: { value: id },
    configuration_id: { value: configurationId },
    deleted_at: { value: null },
    status: { value: StatusEnum.ACTIVE.value },
    isActive: () => true,
});

const makeConfigFinderResult = (casos) => ({
    settings: {
        behaviors: {
            getConfig: (mod, sub) => {
                if (mod === 'agente' && sub === 'casos') return casos;
                if (mod === 'admin' && sub === 'users') return { active_session_limit: 99 };
                return null;
            },
        },
    },
});

describe('AssignationService #getAssignmentConfig', () => {
    afterEach(() => jest.restoreAllMocks());

    it('pasa assignment_active_session_limit de agente/casos a WorkQueueService', async () => {
        const casos = { type_assignment: 'cola_de_trabajo', assignment_active_session_limit: 7 };

        const grupoRepository = { find: async () => makeGroup(GROUP_ID, CONFIG_ID) };
        const globalConfigurationRepository = { find: async () => makeConfigFinderResult(casos) };
        const usuarioRepository = {};

        const captured = {};
        jest.spyOn(WorkQueueService.prototype, 'execute').mockImplementation(async (grupo, config) => {
            captured.config = config;
            return 'user-1';
        });

        const service = new AssignationService(grupoRepository, globalConfigurationRepository, usuarioRepository);
        const result = await service.execute(GROUP_ID);

        expect(result).toBe('user-1');
        expect(captured.config.active_session_limit).toBe(7);
    });

    it('cae al default 2 cuando agente/casos no define la clave', async () => {
        const casos = { type_assignment: 'cola_de_trabajo' };

        const grupoRepository = { find: async () => makeGroup(GROUP_ID, CONFIG_ID) };
        const globalConfigurationRepository = { find: async () => makeConfigFinderResult(casos) };

        const captured = {};
        jest.spyOn(WorkQueueService.prototype, 'execute').mockImplementation(async (grupo, config) => {
            captured.config = config;
            return 'user-1';
        });

        const service = new AssignationService(grupoRepository, globalConfigurationRepository, {});
        await service.execute(GROUP_ID);

        expect(captured.config.active_session_limit).toBe(2);
    });

    it('cae al default 2 cuando assignment_active_session_limit es 0', async () => {
        const casos = { type_assignment: 'cola_de_trabajo', assignment_active_session_limit: 0 };

        const grupoRepository = { find: async () => makeGroup(GROUP_ID, CONFIG_ID) };
        const globalConfigurationRepository = { find: async () => makeConfigFinderResult(casos) };

        const captured = {};
        jest.spyOn(WorkQueueService.prototype, 'execute').mockImplementation(async (grupo, config) => {
            captured.config = config;
            return 'user-1';
        });

        const service = new AssignationService(grupoRepository, globalConfigurationRepository, {});
        await service.execute(GROUP_ID);

        expect(captured.config.active_session_limit).toBe(2);
    });
});
