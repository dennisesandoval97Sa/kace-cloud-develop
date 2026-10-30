import { ActionTriggers, Helper } from '../../../shared/index.js';
import { CaseFinder } from '../../domain/CaseFinder.js';
import { CaseCreated } from '../../domain/events/CaseCreated.js';
import createDayjsInstance from '../../../shared/factories/DayjsFactory.js';
import duration from 'dayjs/plugin/duration';
import { UpdateSLATimers } from '../../../shared/domain/services/UpdateSLATimers.js';

export default class ExecuteActionsOnCaseCreated {
    /** @type {ActionExecutionDomainService}  */
    #actionExecutionService; // is initialized in the constructor

    /** @type {import('../../domain/CaseFinder.js').CaseFinder} */
    #caseFinder;

    /** @type {KnexCaseRepository} */
    #caseRepository; // is initialized in the constructor

    /**
     * @param {KnexCaseRepository} caseRepository
     * @param {ActionExecutionDomainService} actionExecutionService
     * @param {import('../../domain/CaseFinder.js').CaseFinder} [caseFinder]
     */
    constructor(caseRepository, actionExecutionService, caseFinder = new CaseFinder(caseRepository)) {
        this.#caseRepository = caseRepository;
        this.#caseFinder = caseFinder;
        this.#actionExecutionService = actionExecutionService;
    }

    /**
     *
     * @param {DomainEvent} domainEvent
     * @returns {Promise<void>}
     */
    async handle(domainEvent) {
        const eventName = domainEvent?.eventName ?? CaseCreated.EVENT_NAME;
        const kase = await this.#runInstrumented(eventName, 'caseFinder', () =>
            this.#caseFinder.execute(domainEvent.aggregateId)
        );
        await this.#runInstrumented(eventName, 'actionExecution', () =>
            this.#actionExecutionService.execute(ActionTriggers.CREATE_CASE.value, kase)
        );
        await this.#runInstrumented(eventName, 'slaTimers', () => this.#updateSLATimers(kase));
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

    /**
     *
     * @param {import('../../domain/Case.js').Case} kase
     * @returns {Promise<void>}
     */
    async #updateSLATimers(kase) {
        try {
            const day = createDayjsInstance({
                plugins: [duration],
            });

            const {
                kase: kaseForAns,
                caseAns,
                shiftManagement,
                stateAns,
                globalConfig,
            } = await this.#caseFinder.executeForAns(kase.id.value);

            const originalValues = kaseForAns.toJson();

            const slaUpdater = new UpdateSLATimers(kaseForAns, shiftManagement, caseAns, stateAns, globalConfig);
            await slaUpdater.execute(day());

            await this.#caseRepository.update(kaseForAns);

            await this.#caseRepository.saveHistory(kaseForAns, originalValues);
        } catch (error) {
            Helper.logError(`Error updating SLA fields: ${error}`, 'SLA');
        }
    }
}
