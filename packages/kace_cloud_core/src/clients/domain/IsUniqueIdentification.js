import { ValidationFailError } from '../../shared/index.js';

export default class IsUniqueIdentification {
    /**
     *
     * @param {KnexClientRepository} repository
     */
    constructor(repository) {
        this.repository = repository;
    }

    /**
     *
     * @param {import ('./Client').Client} client
     * @param {boolean} isUpdate
     */
    async validate(client, isUpdate = false) {
        const clientFound = await this.repository.findByIdentification(
            client.tipo_documento.value,
            client.documento.value
        );

        if (clientFound === null) {
            return;
        }

        if (clientFound && isUpdate && client.id.isEqual(clientFound.id)) {
            return;
        }

        const message = `Client with document ${client.tipo_documento.value}:${client.documento.value} already exists`;
        throw new ValidationFailError(message, 'documento');
    }
}
