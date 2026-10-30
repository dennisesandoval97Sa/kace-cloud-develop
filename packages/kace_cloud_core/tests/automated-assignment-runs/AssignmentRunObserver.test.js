import { jest } from '@jest/globals';
import {
    AssignmentRunObserver,
    RUN_STATUS,
} from '../../src/automated-assignment-runs/domain/services/AssignmentRunObserver.js';

const makeAction = (id, description = 'desc', type = 'asignar_grupo_en_curso') => ({
    id: { value: id },
    description: { value: description },
    action_type: { value: type },
});

describe('AssignmentRunObserver', () => {
    let repository;
    let observer;

    beforeEach(() => {
        repository = { save: jest.fn().mockResolvedValue() };
        observer = new AssignmentRunObserver(repository);
    });

    it('persists a completed run with per-action and per-group detail', async () => {
        observer.recordStart();
        observer.recordActionsFound([makeAction('a1'), makeAction('a2')]);
        observer.recordCapacitySnapshot([
            {
                grupo_id: 'g1',
                capacidad: 3,
                max_cases_per_user: 5,
                users_total: 4,
                users_available: 3,
                available_user_ids: ['u2', 'u1', 'u3'],
                users: [{ id: 'u1', remaining: 3 }],
            },
            { grupo_id: 'g2', capacidad: 0, max_cases_per_user: 5, users_total: 2, users_available: 2, users: [] },
        ]);
        observer.recordPrefilterMetrics({ candidates_distinct: 40 });
        observer.recordActionOutcome(makeAction('a1'), {
            candidates: 30,
            assigned: 3,
            skipped: 1,
            errors: 0,
            duration_ms: 120,
        });
        observer.recordSkipReason('a1', 'no_valid_case_for_users');
        observer.recordGroupAssignment('g1', 3);
        observer.recordTotals({ assigned: 3, skipped: 1, errors: 0 });
        observer.recordOutcome(RUN_STATUS.COMPLETED);

        const run = await observer.persist();

        expect(repository.save).toHaveBeenCalledTimes(1);
        expect(run.status.value).toBe('completed');
        expect(run.actions_evaluated.value).toBe(2);
        expect(run.candidates_total.value).toBe(40);
        expect(run.assigned.value).toBe(3);
        expect(run.skipped.value).toBe(1);
        expect(run.groups_without_capacity.value).toBe(1);
        expect(run.duration_ms.value).toBeGreaterThanOrEqual(0);

        const a1 = run.actions_detail.value.actions.find((a) => a.id === 'a1');
        expect(a1.candidates).toBe(30);
        expect(a1.assigned).toBe(3);
        expect(a1.skip_reasons).toEqual({ no_valid_case_for_users: 1 });

        const g1 = run.capacity_snapshot.value.groups.find((g) => g.grupo_id === 'g1');
        expect(g1.assigned).toBe(3);
        expect(g1.users_total).toBe(4);
        expect(g1.users_available).toBe(3);
        expect(g1.users_with_capacity).toBe(1);
        // Primero los que tienen cupo (orden de prioridad), luego los saturados
        expect(g1.available_users).toEqual([
            { usuario_id: 'u1', with_capacity: true },
            { usuario_id: 'u2', with_capacity: false },
            { usuario_id: 'u3', with_capacity: false },
        ]);
        expect(g1.available_users_truncated).toBe(false);
    });

    it('persists candidates_backlog per action', async () => {
        observer.recordStart();
        observer.recordActionsFound([makeAction('a1')]);
        observer.recordActionOutcome(makeAction('a1'), {
            candidates: 0,
            candidates_backlog: 8575,
            assigned: 0,
            skipped: 1,
            errors: 0,
            duration_ms: 5,
        });

        const run = await observer.persist();

        const a1 = run.actions_detail.value.actions.find((a) => a.id === 'a1');
        expect(a1.candidates).toBe(0);
        expect(a1.candidates_backlog).toBe(8575);
    });

    it('defaults candidates_backlog to null when not provided', async () => {
        observer.recordStart();
        observer.recordActionsFound([makeAction('a2')]);
        observer.recordActionOutcome(makeAction('a2'), { candidates: 5, assigned: 5 });

        const run = await observer.persist();

        const a2 = run.actions_detail.value.actions.find((a) => a.id === 'a2');
        expect(a2.candidates_backlog).toBeNull();
    });

    it('persists backlog_computed_at per action', async () => {
        observer.recordStart();
        observer.recordActionsFound([makeAction('a1')]);
        observer.recordActionOutcome(makeAction('a1'), {
            candidates: 0,
            candidates_backlog: 8575,
            backlog_computed_at: '2026-10-15T10:02:00.000Z',
            skipped: 1,
        });

        const run = await observer.persist();

        const a1 = run.actions_detail.value.actions.find((a) => a.id === 'a1');
        expect(a1.backlog_computed_at).toBe('2026-10-15T10:02:00.000Z');
    });

    it('defaults backlog_computed_at to null when not provided', async () => {
        observer.recordStart();
        observer.recordActionsFound([makeAction('a2')]);
        observer.recordActionOutcome(makeAction('a2'), { candidates: 5, assigned: 5 });

        const run = await observer.persist();

        const a2 = run.actions_detail.value.actions.find((a) => a.id === 'a2');
        expect(a2.backlog_computed_at).toBeNull();
    });

    it('persists candidates_backlog_total from prefilter metrics', async () => {
        observer.recordStart();
        observer.recordActionsFound([makeAction('a1')]);
        observer.recordPrefilterMetrics({ candidates_distinct: 0, candidates_backlog_total: 8575 });
        observer.recordActionOutcome(makeAction('a1'), { candidates: 0, assigned: 0, skipped: 1 });

        const run = await observer.persist();

        expect(run.candidates_backlog_total.value).toBe(8575);
    });

    it('falls back candidates_backlog_total to candidates_distinct when the aggregate is absent', async () => {
        observer.recordStart();
        observer.recordPrefilterMetrics({ candidates_distinct: 40 });

        const run = await observer.persist();

        expect(run.candidates_backlog_total.value).toBe(40);
    });

    it('leaves candidates_backlog_total null when there are no prefilter metrics', async () => {
        observer.recordStart();

        const run = await observer.persist();

        expect(run.candidates_backlog_total.value).toBeNull();
    });

    it('caps persisted available users at 50 per group and flags the truncation', async () => {
        observer.recordStart();
        const manyIds = Array.from({ length: 60 }, (_, i) => `u${i}`);
        observer.recordCapacitySnapshot([
            { grupo_id: 'g1', capacidad: 5, max_cases_per_user: 5, available_user_ids: manyIds, users: [] },
        ]);

        const run = await observer.persist();

        const g1 = run.capacity_snapshot.value.groups[0];
        expect(g1.available_users).toHaveLength(50);
        expect(g1.available_users_truncated).toBe(true);
        expect(g1.users_available).toBeNull();
    });

    it('persists non-work-queue group assignments absent from the capacity snapshot', async () => {
        observer.recordStart();
        observer.recordCapacitySnapshot([
            { grupo_id: 'g1', capacidad: 3, max_cases_per_user: 5, users: [{ id: 'u1', remaining: 3 }] },
        ]);
        observer.recordGroupAssignment('g9', 4);

        const run = await observer.persist();

        expect(run.capacity_snapshot.value.groups).toContainEqual(
            expect.objectContaining({
                grupo_id: 'g9',
                assigned: 4,
                work_queue: false,
                users_total: null,
                users_available: null,
            })
        );
        expect(run.groups_without_capacity.value).toBe(0);
    });

    it('sanitizes Infinity capacity to null (JSON-safe)', async () => {
        observer.recordStart();
        observer.recordCapacitySnapshot([
            {
                grupo_id: 'g1',
                capacidad: Number.POSITIVE_INFINITY,
                max_cases_per_user: undefined,
                users: [{ id: 'u1' }],
            },
        ]);

        const run = await observer.persist();

        expect(run.capacity_snapshot.value.groups[0].capacidad).toBeNull();
        expect(run.capacity_snapshot.value.groups[0].max_cases_per_user).toBeNull();
        expect(run.groups_without_capacity.value).toBe(0);
    });

    it('records error detail and forces status=error', async () => {
        observer.recordStart();
        observer.recordOutcome(RUN_STATUS.COMPLETED);
        observer.recordError(new Error('boom'));

        const run = await observer.persist();

        expect(run.status.value).toBe('error');
        expect(run.error_detail.value.message).toBe('boom');
        // El stack NO se persiste: vive solo en logs; exponerlo por el API filtra internals.
        expect(run.error_detail.value).not.toHaveProperty('stack');
    });

    it('persist is a no-op when recordStart was never called', async () => {
        const run = await observer.persist();
        expect(run).toBeNull();
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('persist never throws when the repository fails (best-effort)', async () => {
        repository.save.mockRejectedValue(new Error('db down'));
        observer.recordStart();

        await expect(observer.persist()).resolves.toBeNull();
    });

    it('persists discarded actions with their reason in actions_detail.not_applicable', async () => {
        observer.recordStart();
        observer.recordNotApplicableActions([
            { action: makeAction('a1', 'Asignacion por cron'), reason: 'automation_window_expired' },
            { action: makeAction('a2'), reason: 'cron_mismatch' },
        ]);
        observer.recordOutcome(RUN_STATUS.NO_ELIGIBLE_ACTIONS);

        await observer.persist();

        const run = repository.save.mock.calls[0][0].toJson();
        expect(run.status).toBe(RUN_STATUS.NO_ELIGIBLE_ACTIONS);
        expect(run.actions_detail.not_applicable).toEqual([
            {
                id: 'a1',
                description: 'Asignacion por cron',
                action_type: 'asignar_grupo_en_curso',
                reason: 'automation_window_expired',
            },
            { id: 'a2', description: 'desc', action_type: 'asignar_grupo_en_curso', reason: 'cron_mismatch' },
        ]);
    });

    it('record* accumulators never throw on null/malformed input', async () => {
        observer.recordStart();

        expect(() => observer.recordNotApplicableActions(null)).not.toThrow();
        expect(() => observer.recordNotApplicableActions('nope')).not.toThrow();
        expect(() => observer.recordNotApplicableActions([null, { action: null, reason: 'x' }])).not.toThrow();
        expect(() => observer.recordActionsFound(null)).not.toThrow();
        expect(() => observer.recordActionsFound('nope')).not.toThrow();
        expect(() => observer.recordCapacitySnapshot(null)).not.toThrow();
        expect(() => observer.recordCapacitySnapshot('nope')).not.toThrow();
        expect(() => observer.recordCapacitySnapshot([null])).not.toThrow();
        expect(() => observer.recordActionOutcome({ id: { value: 'a1' } }, null)).not.toThrow();
        expect(() => observer.recordTotals(null)).not.toThrow();
        expect(() => observer.recordSkipReason(null, null)).not.toThrow();
        expect(() => observer.recordGroupAssignment(null)).not.toThrow();
        expect(() => observer.recordOutcome(null)).not.toThrow();
        expect(() => observer.recordError(null)).not.toThrow();

        await expect(observer.persist()).resolves.toBeDefined();
    });
});
