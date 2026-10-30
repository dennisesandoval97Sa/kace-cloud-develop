import { State, StateFinderDomain } from '../..';
import { CustomError, UniquenessValidator } from '../../../shared/index.js';

export class StateCreator {
    /** @type {KnexStateRepository} is initialized in the constructor */
    #repository;
    /** @type {StateFinderDomain} is initialized in the constructor */
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     *
     * @param {KnexStateRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new StateFinderDomain(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the creation of an State object and saves it to the repository.
     *
     * @param {object} dto - The data transfer object containing the properties for the State object.
     * @returns {Promise<void>} A promise that resolves when the State object is saved.
     */
    async execute(dto) {
        if (dto === null || dto === undefined) throw new Error('dto cannot be null or undefined');

        const state = State.create(dto);

        const result = await this.#finder.execute(state.id.value);
        if (result) {
            throw new CustomError(`State with id ${state.id.value} already exists`, 400);
        }

        const uniquenessFields = this.#prepareUniquenessFields(dto);
        await this.#uniquenessValidator.validateMultiple(uniquenessFields);

        await this.#repository.save(state);
        await this.#repository.saveHistory(state);
    }

    #prepareUniquenessFields(dto) {
        return [
            { field: 'nombre', value: dto.nombre },
            { field: 'icon_class', value: dto.icon_class },
            { field: 'require_observation', value: dto.require_observation },
        ];
    }
}
