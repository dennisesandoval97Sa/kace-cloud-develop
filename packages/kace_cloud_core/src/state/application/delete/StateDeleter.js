import { ValidationFailError } from '../../../shared';
import { CustomError } from '../../../shared/errors/CustomError';
import { TransitionsFinderByState } from '../../../transition';
import { StateFinderDomain } from '../../index';

export class StateDeleter {
    /**
     * @type {StateFinderDomain}
     * is initialized in the constructor
     */
    #finder;

    /** @type {KnexStateRepository} is initialized in the constructor */
    #repository;

    /** @type {TransitionsFinderByState} is initialized in the constructor */
    #transitionsFinderByState;

    /**
     *
     * @param {KnexStateRepository} repository
     */
    constructor(repository, transitionRepository) {
        this.#repository = repository;
        this.#transitionsFinderByState = new TransitionsFinderByState(transitionRepository);
        this.#finder = new StateFinderDomain(repository);
    }

    /**
     * Deletes an State object from the repository.
     *
     * @param {string} id - The unique identifier of the State object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the State object.
     * @returns {Promise<void>} A promise that resolves when the State object is deleted.
     */
    async execute(id, dto) {
        const state = await this.#finder.execute(id);

        if (state === null) {
            throw new CustomError(`The state you are trying delete does not exist`, 404);
        }
        await this.#validateStateIsNotInUse(id);

        const originalValues = state.toJson();
        state.delete(dto);

        await this.#repository.delete(state);
        await this.#repository.saveHistory(state, originalValues);

        state.flushChanges();
    }

    /**
     * Validates that the state is not being used by any transition.
     *
     * @param {string} stateId - The state ID to validate.
     * @throws {CustomError} When state is being used by transitions.
     * @private
     */
    async #validateStateIsNotInUse(stateId) {
        const transitionsUsingState = await this.#transitionsFinderByState.execute(stateId);

        if (transitionsUsingState.length > 0) {
            throw new ValidationFailError(
                `Cannot delete state. It is being used by ${transitionsUsingState.length} transition(s)`,
                'state'
            );
        }
    }
}
