import { InteractionResponse } from './InteractionResponse.js';

export class InteractionCollectionResponse {
    /** @type {Interaction[]} is initialized in the constructor */
    #interactions;

    /** @type {integer} is initialized in the constructor */
    #count;
    /**
     *
     * @param {Workspaces[]} workspaces
     */

    constructor(interactions, count) {
        this.#interactions = interactions;
        const rawCount = count?.count ?? count?.['count(*)'] ?? count;
        this.#count = Number(rawCount) || 0;
    }

    toJson() {
        return {
            data: {
                items: this.#interactions.map((interaction) => new InteractionResponse(interaction).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
