import { AppointmentTimeSlotsFinder as DomainAppointmentTimeSlotsFinder } from '../../domain/AppointmentTimeSlotsFinder';
import { AppointmentTimeSlotsResponse } from '../AppointmentTimeSlotsResponse';

export class AppointmentTimeSlotsFinder {
    /**
     * @type {DomainAppointmentTimeSlotsFinder} is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexAppointmentTimeSlotsRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainAppointmentTimeSlotsFinder(repository);
    }

    /**
     * Execute the use case of finding an appointment time slot.
     *
     * @param {string} id - The id of the appointment time slot to find.
     *
     * @returns {Promise<?AppointmentTimeSlotsResponse>}
     */
    async execute(id) {
        const appointmentTimeSlot = await this.#finder.execute(id);

        if (!appointmentTimeSlot || appointmentTimeSlot.isDeleted()) {
            return null;
        }

        return new AppointmentTimeSlotsResponse(appointmentTimeSlot);
    }
}
