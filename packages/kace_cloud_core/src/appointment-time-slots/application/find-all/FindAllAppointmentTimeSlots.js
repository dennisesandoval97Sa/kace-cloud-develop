import { AppointmentTimeSlotsCollectionResponse } from '../AppointmentTimeSlotsCollectionResponse';

export class FindAllAppointmentTimeSlots {
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
     * Execute the use case of finding all appointment time slots.
     *
     * @returns {Promise<AppointmentTimeSlotsCollectionResponse>}
     */
    async execute() {
        const appointmentTimeSlots = await this.#repository.findAll();
        return new AppointmentTimeSlotsCollectionResponse(appointmentTimeSlots, appointmentTimeSlots.length);
    }
}
