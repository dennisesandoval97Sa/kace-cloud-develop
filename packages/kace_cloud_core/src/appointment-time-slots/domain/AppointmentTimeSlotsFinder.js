import { ValueObjectUuid } from '../../shared';

export class AppointmentTimeSlotsFinder {
    /**
     * @type {KnexAppointmentTimeSlotsRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @param {KnexAppointmentTimeSlotsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Execute and get the appointment time slots by id
     *
     * @param {string} id - The appointment time slots id
     * @return {Promise<AppointmentTimeSlots>} - The appointment time slots
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
