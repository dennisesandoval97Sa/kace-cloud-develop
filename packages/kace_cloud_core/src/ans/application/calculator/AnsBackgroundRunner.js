import { AnsCalculator } from './AnsCalculator.js';
import { BackgroundProcessEnum } from '../../../shared/domain/enum/BackgroundProcessEnum.js';
import { Helper } from '../../../shared';
import { Types } from '../../domain/Types.js';

export class AnsBackgroundRunner {
    /** @type {KnexCaseRepository} */
    #caseRepository;
    /** @type {import('../../../shared/domain/services/background-execution/BackgroundExecutionService.js').BackgroundExecutionService} */
    #backgroundExecutionService;

    /**
     * Constructor expects dependencies to be injected
     * - caseRepository: repository used by AnsCalculator
     * - backgroundExecutionService: an instance implementing the BackgroundExecutionService interface
     */
    constructor({ caseRepository, backgroundExecutionService }) {
        this.#caseRepository = caseRepository;
        this.#backgroundExecutionService = backgroundExecutionService;
    }

    async execute() {
        const totalStartTime = Date.now();
        Helper.logDebug('=== ANS Background Runner: Starting execution ===');

        if (await this.#isAlreadyRunning()) {
            Helper.logInfo('AnsBackgroundRunner::execute already running, skipping.');
            return { skipped: true, reason: 'already_running' };
        }

        await this.#markBackgroundProcess(true);

        try {
            const measures = Types.toJson();
            const measureKeys = Object.keys(measures);
            Helper.logDebug(`Total measures to process: ${measureKeys.length}`);

            const service = new AnsCalculator(this.#caseRepository);

            for (let i = 0; i < measureKeys.length; i++) {
                const measure = measureKeys[i];
                const measureType = measure.charAt(0).toUpperCase() + measure.slice(1).toLowerCase();

                Helper.logDebug(`\n--- Processing measure ${i + 1}/${measureKeys.length}: ${measureType} ---`);
                Helper.logTime(`Measure-${measureType}`);

                const result = await service.execute({ measurementType: measureType });

                Helper.logTimeEnd(`Measure-${measureType}`);
                Helper.logDebug(
                    `Measure ${measureType} completed: ${result.processedCases} cases processed in ${result.elapsedTime}ms`
                );
            }

            const totalElapsedTime = Date.now() - totalStartTime;
            Helper.logDebug(
                `\n=== ANS Background Runner: Completed in ${totalElapsedTime}ms (${(totalElapsedTime / 1000).toFixed(2)}s) ===`
            );
        } finally {
            try {
                await this.#markBackgroundProcess(false);
            } catch (err) {
                Helper.logError('Failed to update background execution status:', err);
            }
        }
    }

    /**
     * Verifies if the ANS calculation process is already running.
     * A process is considered "not running" if no record exists, if the record
     * is not marked as running, or if the lock has gone stale (zombie protection).
     *
     * @param {number} [stalenessMinutes=30] - Minutes after which a running lock is considered stale.
     * @returns {Promise<boolean>} True if a process is actively running, false otherwise.
     */
    async #isAlreadyRunning(stalenessMinutes = 30) {
        try {
            const backgroundExecution = await this.#backgroundExecutionService.findBackgroundExecution(
                BackgroundProcessEnum.ANS_CALCULATION.value
            );

            if (!backgroundExecution || !backgroundExecution.isRunning()) {
                return false;
            }

            if (backgroundExecution.isStale(stalenessMinutes)) {
                Helper.logInfo('AnsBackgroundRunner::isAlreadyRunning lock is stale, allowing re-execution.', {
                    updatedAt: backgroundExecution.updated_at,
                    stalenessMinutes,
                });
                return false;
            }

            return true;
        } catch (error) {
            Helper.logError('AnsBackgroundRunner::isAlreadyRunning error', error);
            return false;
        }
    }

    /**
     * Marks the execution process according to the provided status
     *
     * @param {Boolean} status - Process status (running or not) -> True for running, false for not running
     *
     * @returns {Promise<void>}
     */
    async #markBackgroundProcess(status) {
        await this.#backgroundExecutionService.updateBackgroundExecution(BackgroundProcessEnum.ANS_CALCULATION.value, {
            execution_status: status,
        });
    }
}
