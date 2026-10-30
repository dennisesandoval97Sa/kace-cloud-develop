import { AgendaFinder as DomainAgendaFinder } from '../../domain/AgendaFinder.js';
import { ValidationFailError } from '../../../shared/index.js';

export class AgendaDeleter {
    /**
     * @type {KnexAgendaRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainAgendaFinder} is initialized in the constructor
     */
    #agendaFinder;

    constructor(repository) {
        this.#repository = repository;
        this.#agendaFinder = new DomainAgendaFinder(repository);
    }

    /**
     * Executes the deletion of an Agenda object and updates it in the repository
     * to mark it as deleted.
     *
     * @param {string} id - The id of the Agenda object to delete.
     * @param {Object} dto - The data transfer object containing the properties to update the Agenda object.
     *
     * @returns {Promise<void>} A promise that resolves when the Agenda object is deleted/updated.
     */
    async execute(id, dto) {
        const agenda = await this.#agendaFinder.execute(id);

        if (!agenda) {
            throw new ValidationFailError('Agenda not found.', 'id');
        }

        if (agenda.deleted_at?.value) {
            throw new ValidationFailError('Agenda is already deleted.', 'id');
        }

        const appointmentTimeSlots = await this.#repository.countAppointmentTimeSlot(agenda.id.value);

        if (appointmentTimeSlots > 0) {
            throw new ValidationFailError('The agenda cannot be deleted because there are time slots assigned.', 'id');
        }

        agenda.delete(dto);

        await this.#repository.update(agenda);

        agenda.flushChanges();
    }
}
