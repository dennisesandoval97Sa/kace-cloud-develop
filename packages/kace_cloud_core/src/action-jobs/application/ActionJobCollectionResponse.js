import { ActionJobResponse } from './ActionJobResponse.js';

export class ActionJobCollectionResponse {
    /**
     * @type {ActionJob[]}
     * is initialized in the constructor
     */
    #actionJobs;

    /**
     * @type {number}
     * is initialized in the constructor
     */
    #count;

    /**
     * Creates an instance of ActionJobCollectionResponse.
     *
     * @param {ActionJob[]} actionJobs - An array of ActionJob instances.
     * @param {number} count - The total count of ActionJob items.
     */
    constructor(actionJobs, count) {
        this.#actionJobs = actionJobs;
        this.#count = count;
    }

    /**
     * Converts the collection to a JSON representation.
     *
     * @returns {Object} An object containing the ActionJob data and metadata.
     */
    toJson() {
        return {
            data: {
                items: this.#actionJobs.map((actionJob) => new ActionJobResponse(actionJob).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
