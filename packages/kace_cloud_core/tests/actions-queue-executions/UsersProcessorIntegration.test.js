import { v4 as uuid } from 'uuid';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { globalRoleId, globalRoleIdZeroTrust } from '@kace/database/seeds/20241125105900_usuario_base.js';

import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import { KnexGroupsRepository } from '../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/infrastructure/persistence/KnexGlobalConfigurationRepository.js';
import { UsersProcessor } from '../../src/actions-queue-executions/domain/services/UsersProcessor.js';
import { UserContextBatchLoader } from '../../src/actions-queue-executions/domain/services/UserContextBatchLoader.js';
import { EntityCandidateFinder } from '../../src/actions-queue-executions/domain/services/EntityCandidateFinder.js';
import { ActionConditionsToSqlTranslator } from '../../src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js';
import { createUsersFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';
import { EntityActionValidator } from '../../src/shared/domain/services/EntityActionValidator.js';
import { EntityRulesContextResolver } from '../../src/shared/domain/services/EntityRulesContextResolver.js';

const CREATED_BY = uuid();

function userRow(override = {}) {
    return {
        id: uuid(),
        login: `usr_${uuid().replace(/-/g, '').slice(0, 12)}`,
        nombres: 'Fixture',
        apellido1: 'User',
        apellido2: 'Test',
        email: `fixture_${uuid()}@x.io`,
        telefono: '1234567890',
        movil: '0987654321',
        rol_id: globalRoleId,
        is_active: '1',
        created_at: new Date(),
        created_by: CREATED_BY,
        account_type: 1,
        ...override,
    };
}

const action = (id, conditions) => ({
    id: { value: id },
    conditions: { value: conditions },
    entity: { value: 'user' },
});

const ALL = () => ({ id: 'all', combinator: 'and', rules: [] });

const ROLE_X = (roleId) => ({
    id: 'r',
    combinator: 'and',
    rules: [{ id: 'r1', field: 'usuarios.rol_id', value: roleId, operator: '=', value_type: 'text' }],
});

// usuarios.last_seen_at is intentionally excluded from USUARIOS_COLUMNS in createUsersFieldCatalog()
// so this rule resolves to NO_PREFILTER and forces the full-universe fallback path.
const LAST_SEEN_TRUE = () => ({
    id: 'r',
    combinator: 'and',
    rules: [{ id: 'r1', field: 'usuarios.last_seen_at', value: 'true', operator: '=', value_type: 'text' }],
});

describe('UsersProcessor integration (parity with legacy validator)', () => {
    const knex = knexConfig;
    let usersRepository, groupsRepository, configRepo;

    beforeAll(async () => {
        usersRepository = new KnexUsersRepository(knex);
        groupsRepository = new KnexGroupsRepository(knex);
        configRepo = new KnexGlobalConfigurationRepository(knex);
    });

    beforeEach(async () => {
        // Avoid FK constraint failures from rel_usuarios_grupos and similar.
        await knex.raw('TRUNCATE TABLE usuarios CASCADE');
    });

    function buildProcessor() {
        return new UsersProcessor({
            usersRepository,
            entityActionValidator: new EntityActionValidator(
                new EntityRulesContextResolver({
                    groupsRepository,
                    globalConfigurationRepository: configRepo,
                })
            ),
            candidateFinder: new EntityCandidateFinder({
                entityRepository: usersRepository,
                translator: new ActionConditionsToSqlTranslator({ catalog: createUsersFieldCatalog() }),
                buildBaseQuery: (conn, t) => conn(t).select(`${t}.id`).where('is_active', '1').whereNull('deleted_at'),
            }),
            userContextBatchLoader: new UserContextBatchLoader({
                groupsRepository,
                globalConfigurationRepository: configRepo,
            }),
        });
    }

    async function legacyValidatePairs(users, actions) {
        const validator = new EntityActionValidator(
            new EntityRulesContextResolver({
                groupsRepository,
                globalConfigurationRepository: configRepo,
            })
        );
        const pairs = new Set();
        for (const u of users) {
            for (const a of actions) {
                if (await validator.validate(u, a)) {
                    pairs.add(`${u.id.value}::${a.id.value}`);
                }
            }
        }
        return pairs;
    }

    it('produces the same successPairs as legacy for a mix of translatable + non-translatable actions', async () => {
        // --- Arrange ---
        // 3 users with globalRoleId (matched by ROLE_X), 3 with the zero-trust role (not matched).
        // Both role IDs are seeded by the DB seed so the FK constraint is satisfied.
        const seedUsers = [
            userRow({ rol_id: globalRoleId }),
            userRow({ rol_id: globalRoleId }),
            userRow({ rol_id: globalRoleId }),
            userRow({ rol_id: globalRoleIdZeroTrust }),
            userRow({ rol_id: globalRoleIdZeroTrust }),
            userRow({ rol_id: globalRoleIdZeroTrust }),
        ];
        await knex('usuarios').insert(seedUsers);

        // a1: translatable SQL prefilter (rol_id = globalRoleId) → matches 3 users
        // a2: non-translatable (last_seen_at excluded from catalog) → NO_PREFILTER path; all users
        //     evaluated; last_seen_at is null → toRulesContext transforms to 'false' → 0 matches
        // a3: empty rules (ALL) → translatable empty subset; actually produces NO_PREFILTER
        //     (extractSqlSubset returns null for empty CompositeRule) → universe fallback; all 6 pass
        const actions = [action('a1', ROLE_X(globalRoleId)), action('a2', LAST_SEEN_TRUE()), action('a3', ALL())];

        const allUsers = await usersRepository.findAllActive();
        expect(allUsers).toHaveLength(6);

        // --- Legacy baseline ---
        const legacySet = await legacyValidatePairs(allUsers, actions);

        // --- New processor ---
        const processor = buildProcessor();
        await processor.processEntitiesWithActions(actions);
        const newSet = new Set(
            processor.getSuccessOperations().map((op) => `${op.entity.id.value}::${op.action.id.value}`)
        );

        // --- Assert parity ---
        expect([...newSet].sort()).toEqual([...legacySet].sort());

        // a2 (LAST_SEEN_TRUE) forces NO_PREFILTER → universe_loaded must be true
        expect(processor.getMetrics().universe_loaded).toBe(true);

        // At least one action must have fallen back to no-prefilter (a2 and a3 both do)
        expect(processor.getMetrics().actions_without_prefilter).toBeGreaterThanOrEqual(1);

        // Sanity: a1 was SQL-prefiltered (3 candidates), a2+a3 fallback brings rest via universe
        // Legacy: a1→3 matches, a2→0 matches, a3→6 matches = 9 total pairs
        expect(legacySet.size).toBe(9);
        expect(newSet.size).toBe(9);
    }, 60_000);
});
