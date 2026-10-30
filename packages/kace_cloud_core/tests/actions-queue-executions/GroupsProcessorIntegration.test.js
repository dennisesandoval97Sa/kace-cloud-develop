import { v4 as uuid } from 'uuid';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';

import { KnexGroupsRepository } from '../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { GroupsProcessor } from '../../src/actions-queue-executions/domain/services/GroupsProcessor.js';
import { EntityCandidateFinder } from '../../src/actions-queue-executions/domain/services/EntityCandidateFinder.js';
import { ActionConditionsToSqlTranslator } from '../../src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js';
import { createGroupsFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';
import { EntityActionValidator } from '../../src/shared/domain/services/EntityActionValidator.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

// `grupos.horario_id` apunta a `shift_management`. Un uuid distinto por fila
// obligaria a respaldar tantos horarios como grupos, y ninguno de estos tests
// mira el horario: uno solo, compartido y garantizado en el beforeEach, basta.
const HORARIO_ID = '00000000-0000-4000-8000-0000000000a1';

function groupRow(override = {}) {
    return {
        horario_id: HORARIO_ID,
        nombre: 'Grupo Fixture',
        status: 1,
        created_by: uuid(),
        created_at: new Date(),
        ...override,
    };
}

const action = (id, conditions) => ({
    id: { value: id },
    conditions: { value: conditions },
    entity: { value: 'group' },
});

const NAME_X = (name) => ({
    id: 'r',
    combinator: 'and',
    rules: [{ id: 'r1', field: 'grupos.nombre', value: name, operator: '=', value_type: 'text' }],
});

// grupos.permisos is intentionally excluded from GRUPOS_COLUMNS in createGroupsFieldCatalog()
// so this rule resolves to NO_PREFILTER and forces the full-universe fallback path.
const NON_TRANSLATABLE = () => ({
    id: 'r',
    combinator: 'and',
    rules: [{ id: 'r1', field: 'grupos.permisos', value: '{}', operator: '=', value_type: 'text' }],
});

describe('GroupsProcessor integration (parity with legacy validator)', () => {
    const knex = knexConfig;
    let groupsRepository;

    beforeAll(async () => {
        groupsRepository = new KnexGroupsRepository(knex);
    });

    beforeEach(async () => {
        await knex.raw('TRUNCATE TABLE grupos CASCADE');
        // El reset por test repone `shift_management` desde la plantilla, asi
        // que la fila padre hay que garantizarla en cada `it`, no una vez.
        await ensureParentRow(knex, 'shift_management', HORARIO_ID);
    });

    const buildProcessor = () =>
        new GroupsProcessor({
            groupsRepository,
            entityActionValidator: new EntityActionValidator(),
            candidateFinder: new EntityCandidateFinder({
                entityRepository: groupsRepository,
                translator: new ActionConditionsToSqlTranslator({ catalog: createGroupsFieldCatalog() }),
                buildBaseQuery: (conn, t) => conn(t).select(`${t}.id`).where('status', 1).whereNull('deleted_at'),
            }),
        });

    const legacyValidatePairs = async (groups, actions) => {
        const validator = new EntityActionValidator();
        const pairs = new Set();
        for (const g of groups) {
            for (const a of actions) {
                if (await validator.validate(g, a)) {
                    pairs.add(`${g.id.value}::${a.id.value}`);
                }
            }
        }
        return pairs;
    };

    it('produces the same successPairs as legacy for translatable + non-translatable actions', async () => {
        // --- Arrange ---
        // 2 groups named 'Soporte Technical' (matched by NAME_X), 1 named 'Ventas Domestico' (not matched).
        const ids = [uuid(), uuid(), uuid()];
        await knex('grupos').insert([
            groupRow({ id: ids[0], nombre: 'Soporte Technical', status: 1 }),
            groupRow({ id: ids[1], nombre: 'Ventas Domestico', status: 1 }),
            groupRow({ id: ids[2], nombre: 'Soporte Technical', status: 1 }),
        ]);

        // a1: translatable SQL prefilter (nombre = 'Soporte Technical') → matches 2 groups
        // a2: non-translatable (permisos excluded from catalog) → NO_PREFILTER path; all groups
        //     evaluated by EntityActionValidator; permisos value won't match '{}' literally → 0 matches
        const actions = [action('a1', NAME_X('Soporte Technical')), action('a2', NON_TRANSLATABLE())];

        const allGroups = await groupsRepository.findAllActive();
        expect(allGroups).toHaveLength(3);

        // --- Legacy baseline ---
        const legacySet = await legacyValidatePairs(allGroups, actions);

        // --- New processor ---
        const processor = buildProcessor();
        await processor.processEntitiesWithActions(actions);
        const newSet = new Set(
            processor.getSuccessOperations().map((op) => `${op.entity.id.value}::${op.action.id.value}`)
        );

        // --- Assert parity ---
        expect([...newSet].sort()).toEqual([...legacySet].sort());

        // a2 (NON_TRANSLATABLE) forces NO_PREFILTER → universe_loaded must be true
        expect(processor.getMetrics().universe_loaded).toBe(true);

        // At least one action must have fallen back to no-prefilter (a2 does)
        expect(processor.getMetrics().actions_without_prefilter).toBeGreaterThanOrEqual(1);

        // a1 → 2 matches (both 'Soporte Technical' groups), a2 → 0 matches = 2 total pairs
        expect(legacySet.size).toBe(2);
        expect(newSet.size).toBe(2);
    }, 60_000);
});
