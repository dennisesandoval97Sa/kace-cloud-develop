import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { CaseFactory } from '../../src/factories/CaseFactory.js';
import { GroupFactory } from '../../src/factories/GroupFactory.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('KnexCaseRepository.findOrderedIdsMatchingCondition (integration)', () => {
    const repository = new KnexCaseRepository(knexConfig);

    let responsableId;

    // No per-test cleanup: TestHelper.resetSchemaAndMigrate forces search_path=public on the
    // (single, pool-max-1) connection afterwards, so an unqualified `connection('cases').del()`
    // here would hit the SAME pre-existing schema-qualification bug documented against
    // GroupAssignmentPlannerOrderingByContext/OrderingByContext tests (raw connection('grupos'/
    // 'aux_cases') resolves to public, not the tenant schema). Each test below scopes its
    // assertions via restrictToIds/empty-array, so leftover rows from a previous test cannot
    // leak into the result.

    /**
     * `CaseFactory` resuelve `responsable_id` con `UserFactory` cuando el llamante no lo pasa, y
     * `UserFactory` genera los apellidos con `chance.last()`, que emite `O'connor` o `D'Angelo`
     * en torno al 0.45% de las veces. `ValueObjectUserName` rechaza el apostrofe ASCII, asi que
     * cada uno de los cuatro casos que siembra este archivo era una tirada de dados que lo
     * tumbaba con un `Error creating factory instance` imputado a un `it` al azar. Con un
     * responsable propio -una fila minima en `usuarios`, sin nombres- la relacion no se resuelve.
     */
    const createCase = (overrides = {}) =>
        new CaseFactory(knexConfig).create({ responsable_id: responsableId, ...overrides });

    beforeEach(async () => {
        responsableId = uuidv4();
        await ensureParentRow(repository.connection, 'usuarios', responsableId);
    });

    it('returns only ids, ordered by created_at asc with an id tie-breaker, limited to N', async () => {
        const group = await new GroupFactory(knexConfig).create({});
        const groupId = group.id.value;

        const older = await createCase({
            grupo_id: groupId,
            created_at: '2025-01-01T00:00:00.000Z',
        });
        const newer = await createCase({
            grupo_id: groupId,
            created_at: '2025-06-01T00:00:00.000Z',
        });

        const ids = await repository.findOrderedIdsMatchingCondition(
            { 'cases.fecha_resolucion': null },
            {
                restrictToIds: [older.id.value, newer.id.value],
                work_queue_sorting_rules: [{ assign_strategy: 'created_at', order_type: 'ASC' }],
                limit: 1,
            }
        );

        expect(ids).toEqual([older.id.value]);
    });

    it('does not raise "column reference is ambiguous" when an aux_cases sort rule and a plain shared column (created_at) rule are combined', async () => {
        // Reproduces the production incident: the aux_cases.* rule forces the LEFT JOIN aux_cases,
        // and `created_at` exists on BOTH cases and aux_cases, so an unqualified `order by "created_at"`
        // makes Postgres abort with `column reference "created_at" is ambiguous`.
        const group = await new GroupFactory(knexConfig).create({});
        const groupId = group.id.value;

        const older = await createCase({
            grupo_id: groupId,
            created_at: '2025-01-01T00:00:00.000Z',
        });
        const newer = await createCase({
            grupo_id: groupId,
            created_at: '2025-06-01T00:00:00.000Z',
        });

        const ids = await repository.findOrderedIdsMatchingCondition(
            { 'cases.fecha_resolucion': null },
            {
                restrictToIds: [older.id.value, newer.id.value],
                work_queue_sorting_rules: [
                    { assign_strategy: 'aux_cases.reclamaciones.reiteratividad', order_type: 'DESC' },
                    { assign_strategy: 'created_at', order_type: 'ASC' },
                ],
                limit: 2,
            }
        );

        // With no aux rows the aux expression is NULL for both, so ordering falls through to
        // created_at asc: older before newer. The point is it must NOT throw.
        expect(ids).toEqual([older.id.value, newer.id.value]);
    });

    it('returns [] for an empty restrictToIds without touching the DB', async () => {
        const ids = await repository.findOrderedIdsMatchingCondition(
            { 'cases.fecha_resolucion': null },
            { restrictToIds: [], limit: 10 }
        );
        expect(ids).toEqual([]);
    });
});
