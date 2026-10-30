import { v4 as uuid } from 'uuid';
import { AutomatedAssignmentRun } from '../../src/automated-assignment-runs/domain/AutomatedAssignmentRun.js';

const baseDto = (override = {}) => ({
    id: uuid(),
    started_at: new Date(),
    finished_at: new Date(),
    duration_ms: 10,
    status: 'completed',
    actions_evaluated: 1,
    candidates_total: 3,
    assigned: 0,
    skipped: 1,
    errors: 0,
    groups_without_capacity: 1,
    actions_detail: null,
    capacity_snapshot: null,
    error_detail: null,
    ...override,
});

describe('AutomatedAssignmentRun candidates_backlog_total', () => {
    it('exposes candidates_backlog_total in toJson when provided', () => {
        const run = AutomatedAssignmentRun.create(baseDto({ candidates_backlog_total: 8575 }));
        expect(run.candidates_backlog_total.value).toBe(8575);
        expect(run.toJson().candidates_backlog_total).toBe(8575);
    });

    it('allows a null candidates_backlog_total (historical runs)', () => {
        const run = AutomatedAssignmentRun.create(baseDto({ candidates_backlog_total: null }));
        expect(run.candidates_backlog_total.value).toBeNull();
        expect(run.toJson().candidates_backlog_total).toBeNull();
    });
});
