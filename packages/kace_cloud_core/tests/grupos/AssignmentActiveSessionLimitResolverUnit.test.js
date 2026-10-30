import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { AssignmentActiveSessionLimitResolver } from '../../src/grupos';

const GROUP_ID = uuidv4();
const CONFIG_ID = uuidv4();

const makeGroup = (configurationId) => ({
    configuration_id: { value: configurationId },
});

const makeConfig = (assignment_active_session_limit) => ({
    settings: {
        behaviors: {
            getConfig: (mod, sub) => {
                if (mod === 'agente' && sub === 'casos') {
                    return { assignment_active_session_limit };
                }
                return null;
            },
        },
    },
});

describe('AssignmentActiveSessionLimitResolver', () => {
    it('returns assignment_active_session_limit from grupo.configuration_id → agente/casos', async () => {
        const groupsRepository = {
            find: jest.fn().mockResolvedValue(makeGroup(CONFIG_ID)),
        };
        const globalConfigurationRepository = {
            find: jest.fn().mockResolvedValue(makeConfig(15)),
        };
        // Domain finders call repository.find(ValueObjectUuid) — mirror EntityRulesContextResolver deps shape
        const resolver = new AssignmentActiveSessionLimitResolver({
            groupsRepository,
            globalConfigurationRepository,
        });

        await expect(resolver.resolveForGroup(GROUP_ID)).resolves.toBe(15);
    });

    it('returns 2 when configuration_id is missing', async () => {
        const groupsRepository = {
            find: jest.fn().mockResolvedValue({ configuration_id: { value: null } }),
        };
        const resolver = new AssignmentActiveSessionLimitResolver({
            groupsRepository,
            globalConfigurationRepository: { find: jest.fn() },
        });

        await expect(resolver.resolveForGroup(GROUP_ID)).resolves.toBe(2);
    });

    it('returns 2 when group is not found', async () => {
        const resolver = new AssignmentActiveSessionLimitResolver({
            groupsRepository: { find: jest.fn().mockResolvedValue(null) },
            globalConfigurationRepository: { find: jest.fn() },
        });

        await expect(resolver.resolveForGroup(GROUP_ID)).resolves.toBe(2);
    });

    it.each([undefined, 0, -1, 2.5, 'abc'])(
        'returns 2 when assignment_active_session_limit is invalid (%p)',
        async (value) => {
            const resolver = new AssignmentActiveSessionLimitResolver({
                groupsRepository: { find: jest.fn().mockResolvedValue(makeGroup(CONFIG_ID)) },
                globalConfigurationRepository: { find: jest.fn().mockResolvedValue(makeConfig(value)) },
            });

            await expect(resolver.resolveForGroup(GROUP_ID)).resolves.toBe(2);
        }
    );

    it('returns 2 when config lookup throws', async () => {
        const resolver = new AssignmentActiveSessionLimitResolver({
            groupsRepository: { find: jest.fn().mockRejectedValue(new Error('db')) },
            globalConfigurationRepository: { find: jest.fn() },
        });

        await expect(resolver.resolveForGroup(GROUP_ID)).resolves.toBe(2);
    });
});
