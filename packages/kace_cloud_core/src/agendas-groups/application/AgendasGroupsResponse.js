export class AgendasGroupsResponse {
    /**
     * @type {AgendasGroups} is initialized in the constructor
     */
    #agendasGroups;

    constructor(agendasGroups) {
        this.#agendasGroups = agendasGroups;
    }

    /**
     * Convert the relationship to JSON format.
     *
     * @returns {Object} - The relationship in JSON format or an empty object if the relationship is not set.
     */
    toJson() {
        return this.#agendasGroups ? this.#convertToJson() : {};
    }

    /**
     * Convert the relationship to JSON format.
     *
     * @returns {Object} - The relationship in JSON format.
     */
    #convertToJson() {
        return {
            data: {
                agenda_id: this.#agendasGroups.agenda_id.value,
                group_id: this.#agendasGroups.group_id.value,
            },
        };
    }
}
