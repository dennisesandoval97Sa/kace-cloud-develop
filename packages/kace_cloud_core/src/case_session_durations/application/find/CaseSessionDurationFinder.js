import { CaseSessionDurationFinder as DomainCaseSessionDurationFinder } from '../../domain/CaseSessionDurationFinder.js';
import { CaseSessionDurationResponse } from '../CaseSessionDurationResponse.js';

/**
 * Class responsible for finding a CaseSessionDuration by its ID.
 */
export class CaseSessionDurationFinder {
    /**
     * @type {DomainCaseSessionDurationFinder} is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexCaseSessionDurationRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainCaseSessionDurationFinder(repository);
    }

    /**
     * Executes the search for a CaseSessionDuration object by its ID.
     *
     * @param {string} id
     * @returns {Promise<CaseSessionDurationResponse|null>}
     */
    async execute(id) {
        const caseSessionDuration = await this.#finder.execute(id);

        if (!caseSessionDuration || caseSessionDuration.isDeleted()) {
            return null;
        }

        return new CaseSessionDurationResponse(caseSessionDuration);
    }

    /**
     * Finds an active (unfinished) CaseSessionDuration by case ID and user ID.
     *
     * @param {string} caseId
     * @param {string} userId
     * @returns {Promise<CaseSessionDurationResponse|null>}
     */
    async findByCaseAndUser(caseId, userId) {
        const caseSessionDuration = await this.#finder.findByCaseAndUser(caseId, userId);

        if (!caseSessionDuration) {
            return null;
        }
        return new CaseSessionDurationResponse(caseSessionDuration);
    }
}
