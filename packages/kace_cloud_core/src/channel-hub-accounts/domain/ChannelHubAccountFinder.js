import { ValueObjectUuid } from '../../shared/index.js';

export class ChannelHubAccountFinder {
    /** @type {KnexChannelHubAccountRepository} */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
