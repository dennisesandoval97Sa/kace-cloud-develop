import { AutomationSettingsResponse } from './AutomationSettingsResponse';

export class AutomationSettingsCollectionResponse {
    /** @type {AutomationSettings[]} is initialized in the constructor */
    #automationCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of `AutomationSettingsCollectionResponse`.
     *
     * @param {AutomationSettings[]} automationSettingsCollection - An array of `AutomationSettings` instances.
     * @param {number} count - The total count of AutomationSettings items.
     */
    constructor(automationSettingsCollection, count) {
        this.#automationCollection = automationSettingsCollection;
        this.#count = count;
    }

    /**
     * Converts the collection of `AutomationSettings` objects to a JSON representation.
     *
     * @returns {Object[]} An array of plain objects containing the `AutomationSettings` data.
     */
    toJson() {
        return {
            data: {
                items: this.#automationCollection.map(
                    (endpoint) => new AutomationSettingsResponse(endpoint).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
