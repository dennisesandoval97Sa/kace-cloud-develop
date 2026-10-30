import { ShiftManagementResponse } from './ShiftManagementResponse.js';

export class ShiftManagementCollectionResponse {
    /** @type {ShiftManagement[]} is initialized in the constructor*/
    #shiftManagementCollection;
    /** @type {Number} is initialized in the constructor*/
    #count;

    /**
     * Creates an instance of ShiftManagementCollectionResponse.
     *
     * @param {ShiftManagement[]} shiftManagementCollection - An array of ShiftManagement instances.
     */
    constructor(shiftManagementCollection, count) {
        this.#shiftManagementCollection = shiftManagementCollection;
        this.#count = count;
    }

    /**
     * Converts the ShiftManagement collection to a JSON representation.
     *
     * @returns {Object[]} An array of plain objects representing the ShiftManagement data.
     */
    toJson() {
        return {
            data: {
                items: this.#shiftManagementCollection.map(
                    (shiftManagement) => new ShiftManagementResponse(shiftManagement).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
