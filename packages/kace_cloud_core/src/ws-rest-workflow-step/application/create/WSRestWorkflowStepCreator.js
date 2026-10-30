import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';
import { WSRestWorkflowStepFinderService } from '../../domain/services/WSRestWorkflowStepFinderService.js';
import { WSRestWorkflowStep } from '../../domain/WSRestWorkflowStep.js';

/**
 * Class responsible for creating a WSRestWorkflowStep.
 */
export class WSRestWorkflowStepCreator {
    /**
     * @type {KnexWSRestWorkflowStepRepository}  is initialized in the constructor
     */
    #repository;

    /**
     * @type {WSRestWorkflowStepFinderService} is initialized in the constructor
     */
    #restWorkflowStepFinder;

    /**
     *
     * @param {KnexWSRestWorkflowStepRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#restWorkflowStepFinder = new WSRestWorkflowStepFinderService(repository);
    }

    /**
     * Execute the creation of a WSRestWorkflowStep
     * @param {WSRestWorkflowStep} dto
     */
    async execute(dto) {
        const newRestWorkflowStep = WSRestWorkflowStep.create(dto);

        const restWorkflowStep = await this.#restWorkflowStepFinder.findById(dto.id);
        if (restWorkflowStep) {
            throw new ValidationFailError('WSRestWorkflowStep already exists', 'id');
        }

        await this.#repository.save(newRestWorkflowStep);
    }
}
