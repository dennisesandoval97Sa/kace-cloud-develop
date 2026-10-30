import { ValidationFailError, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { CaseSessionDurationResponse } from '../CaseSessionDurationResponse.js';
import { ElapsedTimeCalculator } from '../../domain/ElapsedTimeCalculator.js';

/**
 * Updater for CaseSessionDuration aggregate
 * Responsibilities:
 *  - fetch existing aggregate from repository
 *  - validate existence
 *  - apply dto changes via aggregate.update
 *  - persist update, save history and flush changes
 */
export class CaseSessionDurationUpdater {
    /** @type {KnexCaseSessionDurationRepository} */
    #repository;

    /**
     * @param {KnexCaseSessionDurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Updates an existing CaseSessionDuration
     * @param {object} dto - fields to update (finished_at, elapsed_time, etc.)
     * @param {string} id - id of the CaseSessionDuration to update
     * @returns {Promise<CaseSessionDuration>}
     */
    async execute(dto, id) {
        // Fetch existing aggregate
        const caseSessionDuration = await this.#repository.find(new ValueObjectUuid('id', id));
        if (!caseSessionDuration) {
            throw new ValidationFailError(`CaseSessionDuration with id ${id} does not exist`, 'case_session_duration');
        }

        this.ensureValidStates(caseSessionDuration.event_type.value, dto.next_event_type);

        if (dto.finished_at && caseSessionDuration.started_at) {
            const elapsed = ElapsedTimeCalculator.between(caseSessionDuration.started_at.value, dto.finished_at);
            if (elapsed === null) {
                throw new ValidationFailError('finished_at must be after started_at', 'finished_at');
            }
            dto.elapsed_time = elapsed;
        }

        caseSessionDuration.update(dto);
        await this.#repository.update(caseSessionDuration);

        caseSessionDuration.flushChanges();

        return caseSessionDuration;
    }

    ensureValidStates(currentEventType, nextEventType) {
        if (currentEventType === 'PAUSED' && nextEventType !== 'VIEW') {
            throw new ValidationFailError('Cannot modified a paused session to a non-view event', 'next_event_type');
        }
    }
}
