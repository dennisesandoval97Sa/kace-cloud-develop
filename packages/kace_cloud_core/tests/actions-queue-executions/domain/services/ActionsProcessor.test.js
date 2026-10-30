import { jest } from '@jest/globals';
import { ActionsProcessor } from '../../../../src/actions-queue-executions/domain/services/ActionsProcessor.js';
import { BackgroundProcessEnum } from '../../../../src/shared/domain/enum/BackgroundProcessEnum.js';
import { Helper } from '../../../../src/shared/index.js';

describe('ActionsProcessor.isAlreadyRunning', () => {
    const stalenessMinutes = 30;

    it('returns false when there is no background execution record', async () => {
        const backgroundExecutionService = {
            findBackgroundExecution: jest.fn().mockResolvedValue(null),
        };
        const processor = new ActionsProcessor({}, {});

        const result = await processor.isAlreadyRunning(backgroundExecutionService, { stalenessMinutes });

        expect(result).toBe(false);
        expect(backgroundExecutionService.findBackgroundExecution).toHaveBeenCalledWith(
            BackgroundProcessEnum.ACTION_QUEUE_EXECUTION.value
        );
    });

    it('returns true when execution_status is true and lock is fresh', async () => {
        const fresh = {
            execution_status: { value: true },
            isStale: jest.fn().mockReturnValue(false),
        };
        const backgroundExecutionService = {
            findBackgroundExecution: jest.fn().mockResolvedValue(fresh),
        };
        const processor = new ActionsProcessor({}, {});

        const result = await processor.isAlreadyRunning(backgroundExecutionService, { stalenessMinutes });

        expect(result).toBe(true);
        expect(fresh.isStale).toHaveBeenCalledWith(stalenessMinutes);
    });

    it('returns false when execution_status is true but lock is stale', async () => {
        const stale = {
            execution_status: { value: true },
            isStale: jest.fn().mockReturnValue(true),
        };
        const backgroundExecutionService = {
            findBackgroundExecution: jest.fn().mockResolvedValue(stale),
        };
        const processor = new ActionsProcessor({}, {});

        const result = await processor.isAlreadyRunning(backgroundExecutionService, { stalenessMinutes });

        expect(result).toBe(false);
        expect(stale.isStale).toHaveBeenCalledWith(stalenessMinutes);
    });

    it('uses default stalenessMinutes=30 when not provided', async () => {
        const stale = {
            execution_status: { value: true },
            isStale: jest.fn().mockReturnValue(true),
        };
        const backgroundExecutionService = {
            findBackgroundExecution: jest.fn().mockResolvedValue(stale),
        };
        const processor = new ActionsProcessor({}, {});

        await processor.isAlreadyRunning(backgroundExecutionService);

        expect(stale.isStale).toHaveBeenCalledWith(30);
    });
});

describe('ActionsProcessor.findActionsIfEligible', () => {
    it('passes entityFilter "case" to the finder', async () => {
        const finderByTrigger = { execute: jest.fn().mockResolvedValue([]) };
        const automationValidationService = { execute: jest.fn() };
        const processor = new ActionsProcessor(finderByTrigger, automationValidationService);

        await processor.findActionsIfEligible();

        expect(finderByTrigger.execute).toHaveBeenCalledTimes(1);
        const [trigger, options] = finderByTrigger.execute.mock.calls[0];
        expect(trigger).toBe('cron_job');
        expect(options).toEqual({ entityFilter: 'case' });
    });

    it('preserves caller-provided actionTypeFilter alongside entityFilter', async () => {
        const finderByTrigger = { execute: jest.fn().mockResolvedValue([]) };
        const processor = new ActionsProcessor(finderByTrigger, { execute: jest.fn() });

        await processor.findActionsIfEligible({
            actionTypeFilter: { exclude: ['x', 'y'] },
        });

        expect(finderByTrigger.execute).toHaveBeenCalledWith('cron_job', {
            entityFilter: 'case',
            actionTypeFilter: { exclude: ['x', 'y'] },
        });
    });
});

describe('ActionsProcessor.process', () => {
    it('emits a single consolidated applicabilityResults log instead of one per action', async () => {
        const logInfoSpy = jest.spyOn(Helper, 'logInfo').mockImplementation(() => {});
        const logDebugSpy = jest.spyOn(Helper, 'logDebug').mockImplementation(() => {});
        const logDebug2Spy = jest.spyOn(Helper, 'logDebug2').mockImplementation(() => {});
        const automationValidationService = {
            evaluate: jest
                .fn()
                .mockResolvedValueOnce({ applicable: true, reason: null })
                .mockResolvedValueOnce({ applicable: false, reason: 'automation_window_expired' })
                .mockResolvedValueOnce({ applicable: true, reason: null }),
        };
        const finderByTrigger = { execute: jest.fn().mockResolvedValue([]) };
        const processor = new ActionsProcessor(finderByTrigger, automationValidationService);

        const actions = [
            { id: { value: 'a1' }, automation_id: { value: 'auto1' }, action_type: { value: 'comentar' } },
            { id: { value: 'a2' }, automation_id: { value: 'auto2' }, action_type: { value: 'comentar' } },
            { id: { value: 'a3' }, automation_id: { value: 'auto3' }, action_type: { value: 'comentar' } },
        ];

        await processor.process(actions);

        const applicabilityCalls = logInfoSpy.mock.calls.filter(
            (c) => c[0] === 'ActionsProcessor.applicabilityResults'
        );
        expect(applicabilityCalls).toHaveLength(1);
        expect(applicabilityCalls[0][1]).toMatchObject({
            total: 3,
            applicable: 2,
            notApplicable: 1,
        });

        // El nivel del log de ids (logDebug vs logDebug2) es un detalle de verbosidad,
        // no del contrato: aceptar ambos evita acoplar el test a ese ajuste.
        const idsCalls = [...logDebugSpy.mock.calls, ...logDebug2Spy.mock.calls].filter(
            (c) => c[0] === 'ActionsProcessor.applicabilityResults.ids'
        );
        expect(idsCalls).toHaveLength(1);
        expect(idsCalls[0][1]).toMatchObject({
            applicableIds: ['a1', 'a3'],
            notApplicableIds: ['a2'],
        });

        logInfoSpy.mockRestore();
        logDebugSpy.mockRestore();
        logDebug2Spy.mockRestore();
    });

    it('collects not-applicable actions with their reason and clears them with clearProcessedActions', async () => {
        const logDebugSpy = jest.spyOn(Helper, 'logDebug').mockImplementation(() => {});
        const automationValidationService = {
            evaluate: jest
                .fn()
                .mockResolvedValueOnce({ applicable: false, reason: 'automation_window_expired' })
                .mockResolvedValueOnce({ applicable: true, reason: null }),
        };
        const processor = new ActionsProcessor({ execute: jest.fn() }, automationValidationService);

        const discarded = {
            id: { value: 'a1' },
            automation_id: { value: 'auto1' },
            action_type: { value: 'comentar' },
        };
        const kept = { id: { value: 'a2' }, automation_id: { value: 'auto2' }, action_type: { value: 'comentar' } };

        await processor.process([discarded, kept]);

        expect(processor.getNotApplicableActions()).toEqual([
            { action: discarded, reason: 'automation_window_expired' },
        ]);
        expect(processor.getProcessedActions()).toEqual([kept]);

        processor.clearProcessedActions();
        expect(processor.getNotApplicableActions()).toEqual([]);

        logDebugSpy.mockRestore();
    });
});
