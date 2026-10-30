import { Agenda } from '../../domain/Agenda.js';
import { AgendaFinder as DomainAgendaFinder } from '../../domain/AgendaFinder.js';
import { ValidationFailError } from '../../../shared/index.js';

export class AgendaCreator {
    /**
     * @type {KnexAgendaRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainAgendaFinder} is initialized in the constructor
     */
    #agendaFinder;

    /**
     * @param {KnexAgendaRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#agendaFinder = new DomainAgendaFinder(repository);
    }

    /**
     * Executes the creation of an Agenda object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the Agenda object.
     * @returns {Promise<void>} A promise that resolves when the Agenda object is saved.
     */
    async execute(dto) {
        const agenda = await this.#agendaFinder.execute(dto.id);
        if (agenda) {
            throw new ValidationFailError('Agenda already exists.', 'id');
        }

        const newAgenda = Agenda.create(dto);
        await this.#repository.save(newAgenda);
    }
};
