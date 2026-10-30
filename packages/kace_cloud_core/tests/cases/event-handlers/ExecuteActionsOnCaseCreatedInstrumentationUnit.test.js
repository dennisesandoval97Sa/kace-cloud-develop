import { jest } from '@jest/globals';

import ExecuteActionsOnCaseCreated from '../../../src/cases/application/event-handlers/ExecuteActionsOnCaseCreated.js';
import { Helper } from '../../../src/shared/index.js';

describe('ExecuteActionsOnCaseCreated phase instrumentation', () => {
    let logMetricSpy;

    beforeEach(() => {
        logMetricSpy = jest.spyOn(Helper, 'logMetric').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function buildHandler() {
        const fakeCase = {
            id: { value: 'case-1' },
            toJson: () => ({}),
        };

        const caseFinderStub = {
            execute: jest.fn().mockResolvedValue(fakeCase),
            // Throws so #updateSLATimers short-circuits; its internal try/catch
            // swallows the error, so the slaTimers timer still emits.
            executeForAns: jest.fn().mockRejectedValue(new Error('skip-sla')),
        };

        const actionExecutionServiceStub = {
            execute: jest.fn().mockResolvedValue(undefined),
        };

        const caseRepositoryStub = {
            update: jest.fn().mockResolvedValue(undefined),
            saveHistory: jest.fn().mockResolvedValue(undefined),
        };

        const handler = new ExecuteActionsOnCaseCreated(caseRepositoryStub, actionExecutionServiceStub, caseFinderStub);

        return { handler, caseFinderStub, actionExecutionServiceStub };
    }

    function phasesEmitted() {
        return logMetricSpy.mock.calls
            .filter(([metricName]) => metricName === 'EventProcessor.PhaseLatency')
            .map(([, , , dimensions]) => dimensions);
    }

    it('emits a PhaseLatency metric for each phase with the CasesEventProcessor BC', async () => {
        const { handler } = buildHandler();

        await handler.handle({ aggregateId: 'case-1', eventName: 'kace.core.case.created' });

        const dims = phasesEmitted();
        const phases = dims.map((d) => d.Phase);

        expect(phases).toEqual(expect.arrayContaining(['caseFinder', 'actionExecution', 'slaTimers']));
        dims.forEach((d) => {
            expect(d.BC).toBe('CasesEventProcessor');
            expect(d.EventName).toBe('kace.core.case.created');
        });

        logMetricSpy.mock.calls
            .filter(([metricName]) => metricName === 'EventProcessor.PhaseLatency')
            .forEach(([, value, unit]) => {
                expect(typeof value).toBe('number');
                expect(unit).toBe('Milliseconds');
            });
    });
});
