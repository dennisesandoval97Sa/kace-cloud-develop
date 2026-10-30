import { Helper } from '../../../shared/index.js';
import { CaseFinder } from '../../domain/CaseFinder.js';
import CaseUpdated from '../../domain/events/CaseUpdated.js';

export default class ExecuteActionsOnCaseUpdated {
    /** @type {ActionExecutionDomainService}  */
    #actionExecutionService; // is initialized in the constructor

    /** @type {import('../../domain/CaseFinder.js').CaseFinder} */
    #caseFinder;

    /**
     * @param {KnexCaseRepository} caseRepository
     * @param {ActionExecutionDomainService} actionExecutionService
     * @param {import('../../domain/CaseFinder.js').CaseFinder} [caseFinder]
     */
    constructor(caseRepository, actionExecutionService, caseFinder = new CaseFinder(caseRepository)) {
        this.#caseFinder = caseFinder;
        this.#actionExecutionService = actionExecutionService;
    }

    /**
     *
     * @param {DomainEvent} domainEvent
     * @returns {Promise<void>}
     */
    async handle(domainEvent) {
        const eventName = domainEvent?.eventName ?? CaseUpdated.EVENT_NAME;
        const kase = await this.#runInstrumented(eventName, 'caseFinder', () =>
            this.#caseFinder.execute(domainEvent.aggregateId)
        );
        await this.#runInstrumented(eventName, 'actionExecution', () =>
            this.#actionExecutionService.execute(domainEvent.payload.trigger, kase)
        );
    }

    /**
     * Runs a phase and emits its latency as a CloudWatch metric.
     *
     * @param {string} eventName
     * @param {string} phase
     * @param {() => Promise<*>} fn
     * @returns {Promise<*>}
     */
    async #runInstrumented(eventName, phase, fn) {
        const startedAt = process.hrtime.bigint();
        try {
            return await fn();
        } finally {
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
            Helper.logMetric('EventProcessor.PhaseLatency', durationMs, 'Milliseconds', {
                BC: 'CasesEventProcessor',
                EventName: eventName,
                Phase: phase,
            });
        }
    }
}
