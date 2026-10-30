import { CustomError } from '../../../shared/errors/CustomError';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { StateFinderDomain } from '../../index';

export class StateUpdater {
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
     * Updates an State object in the repository.
     *
     * @param {string} id - The unique identifier of the State object to update.
     * @param {object} dto - The data transfer object containing the properties to update in the State object.
     * @returns {Promise<void>} A promise that resolves when the State object is updated.
     */
    async execute(id, dto) {
        const state = await this.#finder.execute(id);

        if (state === null) {
            throw new CustomError('The state you are trying update does not exist', 404);
        }

        if (dto.nombre || dto.icon_class || dto.require_observation) {
            const uniquenessFields = this.#prepareUniquenessFields(dto, state);
            await this.#uniquenessValidator.validateMultiple(uniquenessFields, id);
        }

        const originalValues = state.toJson();
        state.update(dto);

        await this.#repository.update(state);
        await this.#repository.saveHistory(state, originalValues);
        state.flushChanges();
    }

    #prepareUniquenessFields(dto, state) {
        const fields = ['nombre', 'icon_class', 'require_observation'];

        return fields.map((field) => ({
            field,
            value: dto[field] !== undefined ? dto[field] : state[field].value,
        }));
    }
}
