import { WSRestWorkflowStepFinderService } from '../../domain/services/WSRestWorkflowStepFinderService.js';
import { WSRestWorkflowStepResponse } from '../WSRestWorkflowStepResponse.js';

/**
 * Class responsible for finding a WSRestWorkflowStep.
 */
export class WSRestWorkflowStepFinder {
    /**
     * @type {WSRestWorkflowStepFinderService} is initialized in the constructor
     */
    #finderService;
    /** @type {import('../../../users').User} is initialized in the constructor */
    #currentUser;

    /**
     * @param {KnexWSRestWorkflowStepRepository} repository
     * @param {import('../../../users').User} currentUser - The currently authenticated user object.
     */
    constructor(repository, currentUser) {
        this.#finderService = new WSRestWorkflowStepFinderService(repository);
        this.#currentUser = currentUser;
    }

    /**
     * Execute the find of a WSRestWorkflowStep.
     * @param {string} id
     * @param {Object} [relationship] - Relationships to include in the results.
     * @returns {Promise<WSRestWorkflowStepResponse|null>}
     */
    async execute(id, relationship = null) {
        const wsRestWorkflowStep = await this.#finderService.findById(id, relationship);
        return new WSRestWorkflowStepResponse(wsRestWorkflowStep);
    }
}
