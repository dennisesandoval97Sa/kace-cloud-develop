import { ValueObjectUuid } from '../../shared/index.js';

export class AgendaFinder {
    /** @type {KnexAgendaRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Find an Agenda by its id
     *
     * @param {string} id
     * @return {Promise<Agenda>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
