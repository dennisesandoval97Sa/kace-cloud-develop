import { TransitionsResponse } from './TransitionsResponse';

export class TransitionsCollectionResponse {
    /** @type {Transitions} is initialized in the constructor */
    #transitions;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * @param {Transitions} transitions
     * @param {number} count
     * */
    constructor(transitions, count) {
        this.#transitions = transitions;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#transitions.map((transition) => new TransitionsResponse(transition).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
