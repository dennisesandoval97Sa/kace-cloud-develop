import { EntityRulesContextResolver } from '../../../../src/shared/domain/services/EntityRulesContextResolver.js';

// The resolver's internal finders build `new ValueObjectUuid('id', id)`, which
// throws (and is swallowed by the resolver's try/catch → default) for non-UUID
// ids. Use valid UUIDs so the configuration path is actually exercised.
const GRUPO_ACTIVO_ID = '11111111-1111-4111-8111-111111111111';
const CONFIGURATION_ID = '22222222-2222-4222-8222-222222222222';

const makeEntity = (grupoActivoId) => ({
    grupo_activo: { value: grupoActivoId },
    toRulesContext(limit) {
        return { activeSessionLimit: limit };
    },
});

describe('EntityRulesContextResolver', () => {
    it('resuelve assignment_active_session_limit desde agente/casos', async () => {
        const groupsRepository = {
            find: async () => ({ configuration_id: { value: CONFIGURATION_ID } }),
        };
        const globalConfigurationRepository = {
            find: async () => ({
                settings: {
                    behaviors: {
                        getConfig: (mod, sub) =>
                            mod === 'agente' && sub === 'casos' ? { assignment_active_session_limit: 10 } : null,
                    },
                },
            }),
        };

        const resolver = new EntityRulesContextResolver({ groupsRepository, globalConfigurationRepository });
        const result = await resolver.resolve(makeEntity(GRUPO_ACTIVO_ID));

        expect(result).toEqual({ activeSessionLimit: 10 });
    });

    it('cae al default 2 cuando la clave no está en agente/casos', async () => {
        const groupsRepository = {
            find: async () => ({ configuration_id: { value: CONFIGURATION_ID } }),
        };
        const globalConfigurationRepository = {
            find: async () => ({
                settings: { behaviors: { getConfig: () => ({}) } },
            }),
        };

        const resolver = new EntityRulesContextResolver({ groupsRepository, globalConfigurationRepository });
        const result = await resolver.resolve(makeEntity(GRUPO_ACTIVO_ID));

        expect(result).toEqual({ activeSessionLimit: 2 });
    });

    it('cae al default 2 cuando assignment_active_session_limit es 0', async () => {
        const groupsRepository = {
            find: async () => ({ configuration_id: { value: CONFIGURATION_ID } }),
        };
        const globalConfigurationRepository = {
            find: async () => ({
                settings: {
                    behaviors: {
                        getConfig: (mod, sub) =>
                            mod === 'agente' && sub === 'casos' ? { assignment_active_session_limit: 0 } : null,
                    },
                },
            }),
        };

        const resolver = new EntityRulesContextResolver({ groupsRepository, globalConfigurationRepository });
        const result = await resolver.resolve(makeEntity(GRUPO_ACTIVO_ID));

        expect(result).toEqual({ activeSessionLimit: 2 });
    });

    it('cae al default 2 cuando la entidad no tiene grupo_activo', async () => {
        const resolver = new EntityRulesContextResolver({
            groupsRepository: { find: async () => null },
            globalConfigurationRepository: { find: async () => null },
        });
        const result = await resolver.resolve(makeEntity(null));

        expect(result).toEqual({ activeSessionLimit: 2 });
    });
});
