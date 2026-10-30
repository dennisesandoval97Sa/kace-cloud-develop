import { ValidationFailError } from '../../shared/index.js';

export default class IsUniqueId {
    /**
     *
     * @param {KnexClientRepository} repository
     */
    constructor(repository) {
        this.repository = repository;
    }

    /**
     *
     * @param {import ('Client').Client} client
     */
    async validate(client) {
        const found = await this.repository.find(client.id);
        if (found) {
            throw new ValidationFailError(`Client with id ${client.id.value} already exists`, 'id');
        }
    }
}
