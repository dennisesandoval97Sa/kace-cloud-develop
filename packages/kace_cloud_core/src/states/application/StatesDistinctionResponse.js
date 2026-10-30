export class StatesDistinctionResponse {
    /** @type {Array} is initialized in the constructor */
    #statesDistinction;

    constructor(statesDistinction) {
        this.#statesDistinction = statesDistinction;
    }

    toJson() {
        return {
            data: {
                items: this.#statesDistinction,
            },
        };
    }
}
