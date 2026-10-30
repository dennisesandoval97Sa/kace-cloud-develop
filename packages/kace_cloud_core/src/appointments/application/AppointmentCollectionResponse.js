import { AppointmentResponse } from './AppointmentResponse.js';

/**
 * Class representing a collection response for Appointment objects.
 */
export class AppointmentCollectionResponse {
    /**
     * @type {Appointment[]} is initialized in the constructor
     */
    #appointments;

    /**
     * @type {number} is initialized in the constructor
     */
    #count;

    /**
     * @param {Appointment[]} appointments
     * @param {number} count
     */
    constructor(appointments, count) {
        this.#appointments = appointments;
        this.#count = count;
    }

    /**
     * Converts the collection of Appointment objects to a JSON representation.
     * @returns {Object} The JSON representation of the Appointment collection.
     */
    toJson() {
        return {
            data: {
                items: this.#appointments.map((appointment) => new AppointmentResponse(appointment).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
