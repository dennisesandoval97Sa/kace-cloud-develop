import { AvailableStatesResponse } from '../index.js';

export class AvailableStatesCollectionsResponse {
    /**
     * @type {CaseAvailableStates}
     * is initialized in the constructor
     */
    #kase;

    /**
     *
     * @param {CaseAvailableStates[]} kase instance to return as a json
     */
    constructor(kase) {
        this.#kase = kase;
    }

    /**
     *
     * @returns {object}
     */
    toJson() {
        if (this.#kase === null) return {};
        return {
            data: {
                items: this.#kase.map((transition) => new AvailableStatesResponse(transition).toJson().data),
            },
        };
    }
}
