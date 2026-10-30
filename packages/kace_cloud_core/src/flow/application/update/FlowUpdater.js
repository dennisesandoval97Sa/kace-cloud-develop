import { CustomError } from '../../../shared/errors/CustomError';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { FlowFinderDomain } from '../../index';

export class FlowUpdater {
    /** @type {KnexFlowRepository} is initialized in the constructor */
    #repository;

    /** @type {FlowFinderDomain} is initialized in the constructor */
    #finder;

    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     *
     * @param {KnexFlowRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new FlowFinderDomain(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     *
     * @param {object} dto Object with data flow for update
     * @param {string} id string with id for update
     * @param {import('knex').Knex.Transaction} [trx]
     * @throws {CustomError} If the flow you are trying update does not exist
     * @returns {Promise<void>}
     */
    async execute(dto, id, trx = null) {
        const finder = await this.#finder.execute(id);

        if (finder === null) {
            throw new CustomError('The flow you are trying update does not exist', 404);
        }

        if (dto.nombre) {
            await this.#uniquenessValidator.validate('nombre', dto.nombre, id);
        }

        const originalValues = finder.toJson();
        finder.update(dto);

        await this.#repository.update(finder, trx);
        await this.#repository.saveHistory(finder, originalValues, trx);

        finder.flushChanges();
    }
}
