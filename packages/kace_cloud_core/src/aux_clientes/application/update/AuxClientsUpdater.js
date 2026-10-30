import { CustomError } from '../../../shared/errors/CustomError';
import { DomainAuxClientsFinder, DomainAuxClientsFinderByClient } from '../../index.js';
import { ValidationFailError } from '../../../shared/index.js';

export class AuxClientsUpdater {
    /** @type {DomainAuxClientsFinder} is initialized in the constructor */
    #finder;

    /** @type {KnexAuxClientsRepository} is initialized in the constructor */
    #repository;

    /** @type {DomainAuxClientsFinderByClient} is initialized in the constructor */
    #finderByClientId;

    /**
     *
     * @param {KnexAuxClientsRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainAuxClientsFinder(repository);
        this.#repository = repository;
        this.#finderByClientId = new DomainAuxClientsFinderByClient(repository);
    }

    /**
     *
     * @param {object} dto Object data for update
     * @param {string} id record identificator for update
     */
    async execute(dto, id) {
        let auxClient = await this.#finder.execute(id);

        if (!auxClient) {
            auxClient = await this.#finderByClientId.execute(id);
        }

        if (!auxClient) {
            throw new CustomError('Aux client you try update does not exist', 404);
        }

        if (dto.deleted_at || dto.deleted_by) {
            throw new ValidationFailError('El auxiliar no puede ser eliminado', 'dto.deleted');
        }

        if (!dto.data || Object.keys(dto.data).length === 0) {
            throw new ValidationFailError('El item data no puede estar vacio', 'dto.data');
        }

        const originalValues = auxClient.toJson();
        auxClient.update(dto);

        await this.#repository.update(auxClient);
        await this.#repository.saveHistoryWithRelationships(auxClient, originalValues, auxClient.cliente_id);

        auxClient.flushChanges();
    }
}
