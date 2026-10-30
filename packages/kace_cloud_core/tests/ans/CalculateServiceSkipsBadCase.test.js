import { jest } from '@jest/globals';

// Simulate the guarded infinite-loop case: UpdateSLATimers throws for one specific case.
// CalculateService must skip+log that case and keep processing the rest, never aborting the
// whole recalc (and never freezing — the guard already turns the hang into a throw).
jest.unstable_mockModule('../../src/shared/domain/services/UpdateSLATimers.js', () => ({
    UpdateSLATimers: class {
        constructor(kase) {
            this.kase = kase;
        }
        execute() {
            if (this.kase.id.value === 'bad') {
                throw new Error('ExpirationCalculator: exceeded 50000 iterations');
            }
            this.kase.changedAttributes = { sla_elapsed_time: `ok-${this.kase.id.value}` };
            return this.kase;
        }
    },
}));

const { CalculateService, Types } = await import('../../src/ans/index.js');

const row = (id) => ({
    kase: { id: { value: id }, flushChanges() {}, changedAttributes: {} },
    caseAns: {},
    shiftManagement: {},
    stateAns: null,
    globalConfig: null,
});

describe('CalculateService — skips a case whose SLA cannot be computed', () => {
    it('logs and skips the throwing case but still persists the good ones', async () => {
        const pages = [[row('good1'), row('bad'), row('good2')], []];
        let call = 0;
        const captured = [];
        const repo = {
            findUnresolvedByMeasurementTypePaginated: jest.fn(async () => pages[call++] ?? []),
            bulkUpdateSlaTimers: jest.fn(async (updates) => {
                captured.push(...updates);
            }),
        };

        const svc = new CalculateService(repo);
        const result = await svc.execute(Types.MINUTES.value);

        // The recalc completes (does not reject) and processes every row.
        expect(result.processedCases).toBe(3);
        // Only the two good cases are persisted; the bad one is skipped.
        const ids = captured.map((u) => u.id).sort();
        expect(ids).toEqual(['good1', 'good2']);
    });
});
