import { AgendaFinder as DomainAgendaFinder } from '../../domain/AgendaFinder.js';
import { AgendaResponse } from '../AgendaResponse.js';

export class AgendaFinder {
    /**
     * @type {DomainAgendaFinder} is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexAgendaRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainAgendaFinder(repository);
    }

    /**
     * Executes the finding of an Agenda object by its id.
     *
     * @param {string} id - The id of the Agenda object to find.
     * @returns {Promise<?AgendaResponse>} A promise that resolves with the Agenda object found.
     */
    async execute(id) {
        const agenda = await this.#finder.execute(id);

        if (!agenda || agenda.isDeleted()) {
            return null;
        }

        return new AgendaResponse(agenda);
    }
}
