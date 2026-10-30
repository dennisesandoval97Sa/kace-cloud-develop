import { jest } from '@jest/globals';

import ExecuteActionsOnCaseUpdated from '../../../src/cases/application/event-handlers/ExecuteActionsOnCaseUpdated.js';
import { Helper } from '../../../src/shared/index.js';

describe('ExecuteActionsOnCaseUpdated phase instrumentation', () => {
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
        };

        const actionExecutionServiceStub = {
            execute: jest.fn().mockResolvedValue(undefined),
        };

        const caseRepositoryStub = {};

        const handler = new ExecuteActionsOnCaseUpdated(caseRepositoryStub, actionExecutionServiceStub, caseFinderStub);

        return { handler, caseFinderStub, actionExecutionServiceStub };
    }

    function phaseDimensions() {
        return logMetricSpy.mock.calls
            .filter(([metricName]) => metricName === 'EventProcessor.PhaseLatency')
            .map(([, , , dimensions]) => dimensions);
    }

    it('emits a PhaseLatency metric for each phase with the CasesEventProcessor BC', async () => {
        const { handler } = buildHandler();

        await handler.handle({
            aggregateId: 'case-1',
            eventName: 'kace.core.case.updated',
            payload: { trigger: 'UPDATE_CASE' },
        });

        const dims = phaseDimensions();
        const phases = dims.map((d) => d.Phase);

        expect(phases).toEqual(expect.arrayContaining(['caseFinder', 'actionExecution']));
        dims.forEach((d) => {
            expect(d.BC).toBe('CasesEventProcessor');
            expect(d.EventName).toBe('kace.core.case.updated');
        });

        logMetricSpy.mock.calls
            .filter(([metricName]) => metricName === 'EventProcessor.PhaseLatency')
            .forEach(([, value, unit]) => {
                expect(typeof value).toBe('number');
                expect(unit).toBe('Milliseconds');
            });
    });
});
