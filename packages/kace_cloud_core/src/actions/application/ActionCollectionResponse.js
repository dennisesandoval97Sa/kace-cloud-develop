import { ActionResponse } from './ActionResponse.js';

export class ActionCollectionResponse {
    /**
     * @type {Action[]}
     * is initialized in the constructor
     */
    #actions;

    /**
     * @type {number}
     * is initialized in the constructor
     */
    #count;

    /**
     * Creates an instance of ActionCollectionResponse.
     *
     * @param {Action[]}actions
     * @param {number} count - The total count of Action items.
     */
    constructor(actions, count) {
        this.#actions = actions;
        this.#count = count;
    }

    /**
     *
     * @returns {Object} An object containing the action data and metadata.
     */
    toJson() {
        return {
            data: {
                items: this.#actions.map((action) => new ActionResponse(action).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
