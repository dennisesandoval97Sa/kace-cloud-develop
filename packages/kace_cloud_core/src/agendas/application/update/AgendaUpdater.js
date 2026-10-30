import { AgendaFinder as DomainAgendaFinder } from '../../domain/AgendaFinder.js';
import { ValidationFailError } from '../../../shared/index.js';

export class AgendaUpdater {
    /**
     * @type {DomainAgendaFinder} is initialized in the constructor
     */
    #agendaFinder;

    /**
     * @type {KnexAgendaRepository} is initialized in the constructor
     */
    #repository;

    constructor(repository) {
        this.#repository = repository;
        this.#agendaFinder = new DomainAgendaFinder(repository);
    }

    /**
     * Executes the updating of an Agenda object and saves it to the repository.
     *
     * @param {string} id - The id of the Agenda object to update.
     * @param {Object} dto - The data transfer object containing the properties to update the Agenda object.
     *
     * @returns {Promise<void>} A promise that resolves when the Agenda object is updated.
     */
    async execute(id, dto) {
        const agenda = await this.#agendaFinder.execute(id);

        if (!agenda) {
            throw new ValidationFailError('Agenda not found.', 'id');
        }

        agenda.update(dto);

        await this.#repository.update(agenda);

        agenda.flushChanges();
    }
}
