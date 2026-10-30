import { AgendaCollectionResponse } from '../AgendaCollectionResponse';

export class FindAllAgendas {
    /**
     * @type {KnexAgendaRepository} is initialized in the constructor
     */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the finding of all Agenda objects.
     *
     * @returns {Promise<?AgendaCollectionResponse>} A promise that resolves with the collection of Agenda objects found.
     */
    async execute() {
        const agendas = await this.#repository.findAll();

        return agendas ? new AgendaCollectionResponse(agendas, agendas.length) : null;
    }
}
