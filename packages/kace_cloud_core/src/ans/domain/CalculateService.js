import createDayjsInstance from '../../shared/factories/DayjsFactory';
import { UpdateSLATimers } from '../../shared/domain/services/UpdateSLATimers';
import { Helper } from '../../shared';

const dayjs = createDayjsInstance({});

const CHUNK_SIZE = 1000;

// The per-case SLA calculation below is synchronous. Running a full 1000-row chunk without
// pausing froze the single Node event loop for >150s, starving the worker's /health probe and
// tripping the ECS health check. Cooperatively yield to the event loop every N rows so other
// I/O (health endpoint, other jobs) can run between bursts.
const YIELD_EVERY_ROWS = 50;

const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Calculator service for processing and updating SLA timers of unresolved cases.
 * APIs that consume this service:
 * - kace_cloud_api_ans_calculate
 */
export class AnsCalculator {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #caseRepository;

    /**
     * @param {KnexCaseRepository} caseRepository
     */
    constructor(caseRepository) {
        this.#caseRepository = caseRepository;
    }

    async execute(measurementType, currentDateTime = dayjs()) {
        const startAt = performance.now();
        let cursor = null;
        let processed = 0;

        Helper.logDebug(`    [CalculateService] Starting chunked execution for ${measurementType}`);

        while (true) {
            const timerQuery = `CalcService-${measurementType}-Chunk-${processed}`;
            Helper.logTime(timerQuery);
            const chunk = await this.#caseRepository.findUnresolvedByMeasurementTypePaginated({
                measurementType,
                afterId: cursor,
                limit: CHUNK_SIZE,
            });
            Helper.logTimeEnd(timerQuery);

            if (chunk.length === 0) {
                break;
            }

            const updates = [];
            let sinceYield = 0;
            for (const entities of chunk) {
                const { kase, caseAns, shiftManagement, stateAns, globalConfig } = entities;

                if (++sinceYield >= YIELD_EVERY_ROWS) {
                    sinceYield = 0;
                    await yieldToEventLoop();
                }

                // Production rows always have caseAns and shiftManagement populated via the LEFT JOIN.
                // Flush the initial-load dirty bits (e.g. updated_at set by the constructor) and run the
                // SLA calculator so that changedAttributes only contains SLA columns afterwards.
                // This guard exists only for unit-test stubs that inject pre-set changedAttributes directly.
                if (caseAns && shiftManagement) {
                    kase.flushChanges();
                    try {
                        const updateSLATimers = new UpdateSLATimers(
                            kase,
                            shiftManagement,
                            caseAns,
                            stateAns,
                            globalConfig
                        );
                        updateSLATimers.execute(currentDateTime);
                    } catch (error) {
                        // One uncomputable case (e.g. a shift with no working days that the
                        // ExpirationCalculator guard rejects) must not abort the whole recalc.
                        // Skip it and keep going so the rest of the tenant's cases still update.
                        Helper.logError('CalculateService: skipping case with uncomputable SLA', {
                            caseId: kase.id?.value,
                            measurementType,
                            err: error?.message,
                        });
                        continue;
                    }
                }

                const changed = kase.changedAttributes ?? {};
                if (Object.keys(changed).length > 0) {
                    updates.push({ id: kase.id.value, changedAttributes: changed });
                }
            }

            if (updates.length > 0) {
                const timerUpdate = `CalcService-${measurementType}-BulkUpdate-${processed}`;
                Helper.logTime(timerUpdate);
                await this.#caseRepository.bulkUpdateSlaTimers(updates);
                Helper.logTimeEnd(timerUpdate);
            }

            processed += chunk.length;
            cursor = chunk[chunk.length - 1].kase.id.value;

            Helper.logDebug(`    [CalculateService] ${measurementType}: processed ${processed} (cursor=${cursor})`);
        }

        const elapsedTime = (performance.now() - startAt) / 1000;
        Helper.logDebug(`    [CalculateService] ${measurementType}: ${processed} cases in ${elapsedTime.toFixed(2)}s`);
        return { processedCases: processed, elapsedTime };
    }
}
