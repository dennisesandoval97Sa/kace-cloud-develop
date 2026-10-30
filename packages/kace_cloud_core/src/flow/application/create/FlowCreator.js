import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { Flow } from '../../index';

export class FlowCreator {
    /** @type {KnexFlowRepository} is initialized in the constructor*/
    #repository;
    /** @type {UniquenessValidator} is initialized in the constructor*/
    #uniquenessValidator;

    /**
     *
     * @param {KnexFlowRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     *
     * @param {object} dto
     * @param {import('knex').Knex.Transaction} [trx]
     * @throws {Error} if dto is null or undefined
     * @returns {Promise<void>}
     */

    async execute(dto, trx = null) {
        if (dto === null || dto === undefined) throw new Error('dto cannot be null or undefined');
        const flowCreator = Flow.create(dto);

        await this.#uniquenessValidator.validate('nombre', dto.nombre);
        await this.#repository.save(flowCreator, trx);
        await this.#repository.saveHistory(flowCreator, undefined, trx);
    }
}
