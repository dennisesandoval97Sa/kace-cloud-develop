import { ValueObjectUuid } from '../../shared';

export class OneScriptFinder {
    /** @type {KnexOneScriptRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
