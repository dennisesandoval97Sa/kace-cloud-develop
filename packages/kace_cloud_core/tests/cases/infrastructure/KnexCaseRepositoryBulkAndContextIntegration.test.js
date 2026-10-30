import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../../knexfile.js';
import { KnexCaseRepository } from '../../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { CaseFactory } from '../../../src/factories/CaseFactory.js';
import { GroupFactory } from '../../../src/factories/GroupFactory.js';
import { TransitionFactory } from '../../../src/factories/TransitionFactory.js';
import { ClassificationFactory } from '../../../src/factories/ClassificationFactory.js';
import { ensureParentRow } from '../../support/ensureParentRow.js';

/**
 * Covers the "cheap branch" bulk-write and context-building methods of KnexCaseRepository:
 * default-trx parameters vs. an explicit transaction, and found/not-found lookups. Reuses the
 * seeding pattern from `KnexCaseRepositoryOrderedIdsIntegration.test.js` (CaseFactory for the
 * parent rows that need `caso_id`, a hand-built `usuarios` row for `responsable_id`).
 */
describe('KnexCaseRepository bulk writes and context builders (integration)', () => {
    const repository = new KnexCaseRepository(knexConfig);

    let responsableId;
    let groupId;
    let transitionId;
    let caso;

    const createCase = (overrides = {}) =>
        new CaseFactory(knexConfig).create({
            responsable_id: responsableId,
            transicion_id: transitionId,
            ...overrides,
        });

    beforeEach(async () => {
        responsableId = uuidv4();
        await ensureParentRow(repository.connection, 'usuarios', responsableId);

        const group = await new GroupFactory(knexConfig).create({});
        groupId = group.id.value;

        const transition = await new TransitionFactory(knexConfig).create({});
        transitionId = transition.id.value;

        caso = await createCase({ grupo_id: groupId });
    });

    describe('#bulkUpdate (via bulkClose / bulkUpdateTransition)', () => {
        it('bulkClose defaults the trx option to {} and updates matching, non-deleted rows', async () => {
            await repository.bulkClose([caso.id.value], { fecha_resolucion: new Date() });

            const row = await repository.connection('cases').where({ id: caso.id.value }).first();
            expect(row.fecha_resolucion).not.toBeNull();
        });
    });

    describe('bulkSaveTransitionHistory', () => {
        const values = () => ({
            transicion_id: transitionId,
            state_change_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: responsableId,
            update_source: 'manual',
        });

        it('defaults the trx option to {} and inserts one history_cases row per case', async () => {
            await repository.bulkSaveTransitionHistory([{ id: caso.id.value }], values());

            const rows = await repository.connection('history_cases').where({ entity_id: caso.id.value });
            expect(rows).toHaveLength(1);
        });

        it('runs on the caller-provided transaction when one is given', async () => {
            await repository.connection.transaction(async (trx) => {
                await repository.bulkSaveTransitionHistory([{ id: caso.id.value }], values(), { trx });
            });

            const rows = await repository.connection('history_cases').where({ entity_id: caso.id.value });
            expect(rows).toHaveLength(1);
        });
    });

    describe('markFirstViewByResponsible', () => {
        it('returns null immediately when caseId is missing, without touching the DB', async () => {
            const result = await repository.markFirstViewByResponsible({ caseId: null, userId: responsableId });

            expect(result).toBeNull();
        });

        it('defaults `when` to now and stamps first_view_at the first time the responsible opens the case', async () => {
            const result = await repository.markFirstViewByResponsible({
                caseId: caso.id.value,
                userId: responsableId,
            });

            expect(result).toBeInstanceOf(Date);
            const row = await repository.connection('cases').where({ id: caso.id.value }).first();
            expect(row.first_view_at).not.toBeNull();
        });
    });

    describe('bulkSaveAssignHistory', () => {
        const values = () => ({
            grupo_id: groupId,
            updated_at: new Date().toISOString(),
            updated_by: responsableId,
            update_source: 'manual',
        });

        it('defaults the trx option to {} and inserts one history_cases row per case', async () => {
            await repository.bulkSaveAssignHistory([{ id: caso.id.value }], values());

            const rows = await repository.connection('history_cases').where({ entity_id: caso.id.value });
            expect(rows).toHaveLength(1);
        });

        it('runs on the caller-provided transaction when one is given', async () => {
            await repository.connection.transaction(async (trx) => {
                await repository.bulkSaveAssignHistory([{ id: caso.id.value }], values(), { trx });
            });

            const rows = await repository.connection('history_cases').where({ entity_id: caso.id.value });
            expect(rows).toHaveLength(1);
        });
    });

    describe('getCasoInfo', () => {
        it('returns null immediately when kase is falsy, without querying the DB', async () => {
            const result = await repository.getCasoInfo(null);

            expect(result).toBeNull();
        });

        it('omits the description when the classification cannot be found', async () => {
            // getCasoInfo takes a loose, Case-shaped object (not a persisted row), so it is free
            // of the FK constraints that make an orphan clasificacion_id unreachable for a real
            // saved case (see getCaseContextById in this same file).
            const looseKase = {
                id: { value: uuidv4() },
                cliente_id: caso.cliente_id,
                clasificacion_id: { value: uuidv4() },
                transicion_id: caso.transicion_id,
                toJson: () => ({}),
            };

            const result = await repository.getCasoInfo(looseKase);

            expect(result.clasificaciones).toBeUndefined();
        });
    });

    describe('buildCaseContextFromDto', () => {
        it('returns empty clients/clasificaciones/aux_clients when the dto has no cliente_id/clasificacion_id', async () => {
            const context = await repository.buildCaseContextFromDto({});

            expect(context.clients).toEqual({});
            expect(context.clasificaciones).toEqual({});
            expect(context.aux_clients).toEqual({});
        });

        it('builds the classification description when clasificacion_id resolves to a real row', async () => {
            // Ground truth read from the row itself: the description is the non-empty nivel1..nivel10
            // values joined, IN ORDER, with ' -> '. Asserting the exact string (instead of
            // `expect.any(String)`) is what makes a reversed order or a different separator fail.
            const row = await repository
                .connection('clasificaciones')
                .where({ id: caso.clasificacion_id.value })
                .first();
            const expectedDescription = Array.from({ length: 10 }, (_, i) => row[`nivel${i + 1}`])
                .filter(Boolean)
                .join(' -> ');
            // Sanity: the fixture really has several levels, so order and separator are observable.
            expect(expectedDescription.split(' -> ').length).toBeGreaterThan(1);

            const context = await repository.buildCaseContextFromDto({
                cliente_id: caso.cliente_id.value,
                clasificacion_id: caso.clasificacion_id.value,
            });

            expect(context.clasificaciones.description).toBe(expectedDescription);
            expect(context.clasificaciones.id).toBe(caso.clasificacion_id.value);
        });
    });

    describe('getStaleSnapshotFields', () => {
        it('returns undefined when the case does not exist', async () => {
            const result = await repository.getStaleSnapshotFields(uuidv4());

            expect(result).toBeUndefined();
        });

        it('returns null transicionId when the case row has no transicion_id', async () => {
            await repository.connection('cases').where({ id: caso.id.value }).update({ transicion_id: null });

            const result = await repository.getStaleSnapshotFields(caso.id.value);

            expect(result.transicionId).toBeNull();
        });
    });

    describe('getPrioritizedCandidateId', () => {
        const insertHistory = (overrides = {}) =>
            repository.connection('history_cases').insert({
                id: uuidv4(),
                entity_id: caso.id.value,
                changed_attributes: {},
                new_attributes: {},
                original_attributes: {},
                created_at: new Date(),
                created_by: responsableId,
                ...overrides,
            });

        it('returns null when the case has no matching history_cases rows', async () => {
            const result = await repository.getPrioritizedCandidateId(caso.id.value);

            expect(result).toBeNull();
        });

        it('returns null when the matching history rows never set a responsable_id', async () => {
            await insertHistory({ changed_attributes: {}, new_attributes: { some_field: 'x' } });

            const result = await repository.getPrioritizedCandidateId(caso.id.value);

            expect(result).toBeNull();
        });

        it('returns null when no candidate responsable is an eligible (active, non-default) user', async () => {
            const ghostResponsableId = uuidv4();
            await insertHistory({
                changed_attributes: { responsable_id: ghostResponsableId },
                new_attributes: { responsable_id: ghostResponsableId },
            });

            const result = await repository.getPrioritizedCandidateId(caso.id.value);

            expect(result).toBeNull();
        });

        it('returns the most recent eligible responsable found in history', async () => {
            const eligibleId = uuidv4();
            await repository.connection('usuarios').insert({
                id: eligibleId,
                is_active: 1,
                codigos_externos: null,
            });
            await insertHistory({
                changed_attributes: { responsable_id: eligibleId },
                new_attributes: { responsable_id: eligibleId },
            });

            const result = await repository.getPrioritizedCandidateId(caso.id.value);

            expect(result).toBe(eligibleId);
        });

        it('skips a more recent non-eligible candidate and falls back to an older eligible one', async () => {
            const ineligibleId = uuidv4(); // no usuarios row at all -> never eligible
            const eligibleId = uuidv4();
            await repository.connection('usuarios').insert({ id: eligibleId, is_active: 1, codigos_externos: null });

            await insertHistory({
                changed_attributes: { responsable_id: eligibleId },
                new_attributes: { responsable_id: eligibleId },
                created_at: new Date(Date.now() - 60_000),
            });
            await insertHistory({
                changed_attributes: { responsable_id: ineligibleId },
                new_attributes: { responsable_id: ineligibleId },
                created_at: new Date(),
            });

            const result = await repository.getPrioritizedCandidateId(caso.id.value);

            expect(result).toBe(eligibleId);
        });
    });

    describe('bulkUpdateSlaTimers', () => {
        it('returns early without querying when every update has an empty/absent changedAttributes', async () => {
            await expect(repository.bulkUpdateSlaTimers([{ id: caso.id.value }])).resolves.toBeUndefined();
            await expect(
                repository.bulkUpdateSlaTimers([{ id: caso.id.value, changedAttributes: {} }])
            ).resolves.toBeUndefined();
        });

        it('builds a per-column CASE expression even when only some updates in the batch touch a given column', async () => {
            const other = await createCase({ grupo_id: groupId });

            await repository.bulkUpdateSlaTimers([
                { id: caso.id.value, changedAttributes: { antiguedad_dias: 1 } },
                { id: other.id.value, changedAttributes: { ans_posicion: 2 } },
            ]);

            const rowA = await repository.connection('cases').where({ id: caso.id.value }).first();
            const rowB = await repository.connection('cases').where({ id: other.id.value }).first();
            expect(rowA.antiguedad_dias).toBe(1);
            expect(rowB.ans_posicion).toBe(2);
            // Column touched only by the OTHER row must be left untouched (the ELSE branch).
            expect(rowA.ans_posicion).not.toBe(2);
        });
    });
});
