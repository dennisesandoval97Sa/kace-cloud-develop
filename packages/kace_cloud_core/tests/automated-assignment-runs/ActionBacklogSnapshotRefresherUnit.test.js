import { jest } from '@jest/globals';
import { ActionBacklogSnapshotRefresher } from '../../src/automated-assignment-runs/application/backlog-snapshots/ActionBacklogSnapshotRefresher.js';
import { NO_PREFILTER } from '../../src/actions-queue-executions/domain/services/EntityCandidateFinder.js';
import { ActionTypes } from '../../src/actions/domain/ActionTypes.js';
import { Helper } from '../../src/shared/infrastructure/utils/Helper.js';
import { AUTOMATION_NOT_APPLICABLE_REASON } from '../../src/automation-settings/domain/AutomationValidationService.js';

const EXTERNAL = ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value;
const makeAction = (id, type = EXTERNAL) => ({
    id: { value: id },
    action_type: { value: type },
    automation_id: { value: `auto-${id}` },
});
const NOW = new Date('2026-10-15T10:02:00Z');

function build({ actions, counts = {}, notApplicable = {} }) {
    const actionsFinder = {
        findActionsIfEligible: typeof actions === 'function' ? actions : jest.fn().mockResolvedValue(actions),
    };
    const candidateFinder = {
        count: jest.fn(async (action) => (action.id.value in counts ? counts[action.id.value] : 0)),
    };
    const snapshotsRepository = {
        upsert: jest.fn().mockResolvedValue(undefined),
        deleteNotIn: jest.fn().mockResolvedValue(0),
    };
    const automationValidation = {
        evaluate: jest.fn(async (automationId) => {
            const reason = notApplicable[automationId.replace('auto-', '')];
            return reason ? { applicable: false, reason } : { applicable: true, reason: null };
        }),
    };
    const refresher = new ActionBacklogSnapshotRefresher({
        actionsFinder,
        automationValidation,
        candidateFinder,
        snapshotsRepository,
        now: () => NOW,
    });
    return { refresher, actionsFinder, automationValidation, candidateFinder, snapshotsRepository };
}

describe('ActionBacklogSnapshotRefresher', () => {
    let logErrorSpy;
    beforeEach(() => {
        logErrorSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        jest.spyOn(Helper, 'logInfo').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    it('asks only for external-code cron actions', async () => {
        const { refresher, actionsFinder } = build({ actions: [] });
        await refresher.execute();
        expect(actionsFinder.findActionsIfEligible).toHaveBeenCalledWith(
            expect.objectContaining({ actionTypeFilter: { include: [EXTERNAL] } })
        );
    });

    it('counts every external-code action and upserts its backlog with computed_at', async () => {
        const { refresher, candidateFinder, snapshotsRepository } = build({
            actions: [makeAction('a1'), makeAction('a2')],
            counts: { a1: 11224, a2: 0 },
        });

        const result = await refresher.execute();

        expect(candidateFinder.count).toHaveBeenCalledTimes(2);
        expect(candidateFinder.count).toHaveBeenCalledWith(expect.objectContaining({ id: { value: 'a1' } }), {
            evaluationNow: expect.anything(),
        });
        expect(snapshotsRepository.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                action_id: 'a1',
                backlog: 11224,
                computed_at: NOW,
                duration_ms: expect.any(Number),
            })
        );
        expect(snapshotsRepository.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ action_id: 'a2', backlog: 0 })
        );
        expect(result).toEqual({ counted: 2, skipped: 0, failed: 0, removed: 0 });
    });

    it('ignores actions of other types even if the finder returns them', async () => {
        const { refresher, candidateFinder } = build({
            actions: [makeAction('a1'), makeAction('x1', ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value)],
        });
        await refresher.execute();
        expect(candidateFinder.count).toHaveBeenCalledTimes(1);
    });

    it('keeps the previous value when the count is unavailable (NO_PREFILTER)', async () => {
        const { refresher, snapshotsRepository } = build({
            actions: [makeAction('a1'), makeAction('a2')],
            counts: { a1: NO_PREFILTER, a2: 7 },
        });

        const result = await refresher.execute();

        expect(snapshotsRepository.upsert).toHaveBeenCalledTimes(1);
        expect(snapshotsRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({ action_id: 'a2' }));
        expect(result).toEqual({ counted: 1, skipped: 0, failed: 1, removed: 0 });
        expect(logErrorSpy).toHaveBeenCalled();
    });

    it('isolates an upsert failure to its own action', async () => {
        const { refresher, snapshotsRepository } = build({ actions: [makeAction('a1'), makeAction('a2')] });
        snapshotsRepository.upsert.mockRejectedValueOnce(new Error('db down'));

        const result = await refresher.execute();

        expect(snapshotsRepository.upsert).toHaveBeenCalledTimes(2);
        expect(result.counted).toBe(1);
        expect(result.failed).toBe(1);
    });

    it('removes snapshots of actions no longer returned, keeping the failed ones', async () => {
        const { refresher, snapshotsRepository } = build({
            actions: [makeAction('a1'), makeAction('a2')],
            counts: { a2: NO_PREFILTER },
        });
        snapshotsRepository.deleteNotIn.mockResolvedValue(3);

        const result = await refresher.execute();

        expect(snapshotsRepository.deleteNotIn).toHaveBeenCalledWith(['a1', 'a2']);
        expect(result.removed).toBe(3);
    });

    it('does not delete anything when the action search returns null', async () => {
        const { refresher, snapshotsRepository, candidateFinder } = build({ actions: null });

        const result = await refresher.execute();

        expect(candidateFinder.count).not.toHaveBeenCalled();
        expect(snapshotsRepository.deleteNotIn).not.toHaveBeenCalled();
        expect(result).toEqual({ counted: 0, skipped: 0, failed: 0, removed: 0 });
    });

    it('clears every snapshot when the search succeeds with no active external-code actions', async () => {
        const { refresher, snapshotsRepository, candidateFinder } = build({ actions: [] });
        snapshotsRepository.deleteNotIn.mockResolvedValue(4);

        const result = await refresher.execute();

        expect(candidateFinder.count).not.toHaveBeenCalled();
        expect(snapshotsRepository.deleteNotIn).toHaveBeenCalledWith([]);
        expect(result).toEqual({ counted: 0, skipped: 0, failed: 0, removed: 4 });
    });

    it('propagates an action search failure without deleting anything', async () => {
        const { refresher, snapshotsRepository } = build({
            actions: jest.fn().mockRejectedValue(new Error('replica down')),
        });

        await expect(refresher.execute()).rejects.toThrow('replica down');
        expect(snapshotsRepository.deleteNotIn).not.toHaveBeenCalled();
    });

    it('a deleteNotIn failure is logged and does not fail the refresh', async () => {
        const { refresher, snapshotsRepository } = build({ actions: [makeAction('a1')] });
        snapshotsRepository.deleteNotIn.mockRejectedValue(new Error('locked'));

        await expect(refresher.execute()).resolves.toEqual({ counted: 1, skipped: 0, failed: 0, removed: 0 });
        expect(logErrorSpy).toHaveBeenCalled();
    });

    it.each([
        AUTOMATION_NOT_APPLICABLE_REASON.AUTOMATION_NOT_FOUND,
        AUTOMATION_NOT_APPLICABLE_REASON.WINDOW_NOT_STARTED,
        AUTOMATION_NOT_APPLICABLE_REASON.WINDOW_EXPIRED,
        AUTOMATION_NOT_APPLICABLE_REASON.INVALID_CRON,
    ])('does not count an action the tick cannot run at any minute (%s) and drops its snapshot', async (reason) => {
        const { refresher, automationValidation, candidateFinder, snapshotsRepository } = build({
            actions: [makeAction('a1'), makeAction('a2')],
            counts: { a2: 5 },
            notApplicable: { a1: reason },
        });

        const result = await refresher.execute();

        expect(automationValidation.evaluate).toHaveBeenCalledWith('auto-a1');
        expect(candidateFinder.count).toHaveBeenCalledTimes(1);
        expect(candidateFinder.count).toHaveBeenCalledWith(expect.objectContaining({ id: { value: 'a2' } }), {
            evaluationNow: expect.anything(),
        });
        expect(snapshotsRepository.upsert).not.toHaveBeenCalledWith(expect.objectContaining({ action_id: 'a1' }));
        expect(snapshotsRepository.deleteNotIn).toHaveBeenCalledWith(['a2']);
        expect(result).toEqual({ counted: 1, skipped: 1, failed: 0, removed: 0 });
    });

    it('still counts an action whose cron only misses the current minute', async () => {
        const { refresher, snapshotsRepository } = build({
            actions: [makeAction('a1')],
            counts: { a1: 9 },
            notApplicable: { a1: AUTOMATION_NOT_APPLICABLE_REASON.CRON_MISMATCH },
        });

        const result = await refresher.execute();

        expect(snapshotsRepository.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ action_id: 'a1', backlog: 9 })
        );
        expect(result).toEqual({ counted: 1, skipped: 0, failed: 0, removed: 0 });
    });

    it('keeps the previous value of an action whose automation cannot be evaluated', async () => {
        const { refresher, automationValidation, candidateFinder, snapshotsRepository } = build({
            actions: [makeAction('a1'), makeAction('a2')],
        });
        automationValidation.evaluate.mockRejectedValueOnce(new Error('replica down'));

        const result = await refresher.execute();

        expect(candidateFinder.count).toHaveBeenCalledTimes(1);
        expect(snapshotsRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({ action_id: 'a2' }));
        expect(snapshotsRepository.deleteNotIn).toHaveBeenCalledWith(['a1', 'a2']);
        expect(result).toEqual({ counted: 1, skipped: 0, failed: 1, removed: 0 });
        expect(logErrorSpy).toHaveBeenCalled();
    });
});
