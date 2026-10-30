import { AppointmentTimeSlotsResponse } from './AppointmentTimeSlotsResponse';

export class AppointmentTimeSlotsCollectionResponse {
    /**
     * @type {AppointmentTimeSlots[]} is initialized in the constructor
     */
    #appointmentTimeSlotsCollection;

    /**
     * @type {number}
     */
    #count;

    constructor(appointmentTimeSlotsCollection, count) {
        this.#appointmentTimeSlotsCollection = appointmentTimeSlotsCollection;
        this.#count = count;
    }

    /**
     * Convert the object to JSON format.
     */
    toJson() {
        return this.#convertToJson();
    }

    /**
     * Convert the object to JSON format.
     *
     * @returns {object} - The object in JSON format.
     * @private
     */
    #convertToJson() {
        return {
            data: {
                items:
                    this.#appointmentTimeSlotsCollection?.map(
                        (appointmentTimeSlots) => new AppointmentTimeSlotsResponse(appointmentTimeSlots).toJson().data
                    ) ?? [],
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
