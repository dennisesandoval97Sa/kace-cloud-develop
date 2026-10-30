import { ValidationFailError } from '../../../shared';
import { AuxClients } from '../../domain/AuxClients';
import { AuxClientResponse } from '../AuxClientResponse';

export class AuxClientsCreator {
    /**
     * @param {KnexAuxClientsRepository} repository
     * is initialized in the constructor
     */
    #repository;

    /**
     *
     * @param {KnexAuxClientsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    async execute(dto) {
        const auxClient = AuxClients.create(dto);
        const result = await this.#repository.findByClient(auxClient.cliente_id);
        if (result) {
            throw new ValidationFailError(
                `AuxCliente with client id ${auxClient.cliente_id.value} already exists`,
                'cliente_id'
            );
        }
        const newRecord = await this.#repository.save(auxClient);
        await this.#repository.saveHistoryWithRelationships(auxClient, null, auxClient.cliente_id);

        return new AuxClientResponse(newRecord);
    }
}
