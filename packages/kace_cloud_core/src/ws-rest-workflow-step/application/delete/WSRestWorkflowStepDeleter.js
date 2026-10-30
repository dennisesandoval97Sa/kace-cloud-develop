import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';
import { WSRestWorkflowStepFinderService } from '../../domain/services/WSRestWorkflowStepFinderService.js';

/**
 * Class responsible for deleting a WSRestWorkflowStep.
 */
export class WSRestWorkflowStepDeleter {
    /**
     * @type {KnexWSRestWorkflowStepRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {WSRestWorkflowStepFinderService}  is initialized in the constructor
     */
    #restWorkflowStepFinder;

    /**
     * @param {KnexWSRestWorkflowStepRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#restWorkflowStepFinder = new WSRestWorkflowStepFinderService(repository);
    }

    /**
     * Execute the deletion of a WSRestWorkflowStep
     * @param {ValueObjectUuid} id
     * @param {WSRestWorkflowStep} dto
     */
    async execute(id, dto) {
        const restWorkflowStep = await this.#restWorkflowStepFinder.findById(id);

        if (!restWorkflowStep || restWorkflowStep.deleted_at?.value) {
            throw new ValidationFailError('WSRestWorkflowStep not found', 'id');
        }

        restWorkflowStep.delete(dto);
        await this.#repository.update(restWorkflowStep);
        restWorkflowStep.flushChanges();
    }
}
