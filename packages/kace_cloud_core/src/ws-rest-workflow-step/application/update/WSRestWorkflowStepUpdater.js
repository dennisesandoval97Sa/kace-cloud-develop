import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';
import { WSRestWorkflowStepFinderService } from '../../domain/services/WSRestWorkflowStepFinderService.js';

/**
 * Class responsible for updating a WSRestWorkflowStep.
 */
export class WSRestWorkflowStepUpdater {
    /**
     * @type {KnexWSRestWorkflowStepRepository} is initialized in the constructor
     */
    #repository;
    /**
     * @type {WSRestWorkflowStepFinderService} is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexWSRestWorkflowStepRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new WSRestWorkflowStepFinderService(repository);
    }

    /**
     * Execute the update of a WSRestWorkflowStep
     * @param {ValueObjectUuid} id
     * @param {WSRestWorkflowStep} dto
     */
    async execute(id, dto) {
        const restWorkflowStep = await this.#finder.findById(id);

        if (!restWorkflowStep) {
            throw new ValidationFailError('WSRestWorkflowStep not found', 'id');
        }

        restWorkflowStep.update(dto);

        await this.#repository.update(restWorkflowStep);
        restWorkflowStep.flushChanges();
    }
}
