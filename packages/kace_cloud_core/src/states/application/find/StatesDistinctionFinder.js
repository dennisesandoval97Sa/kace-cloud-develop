import { DomainStatesDistinctionFinder, StatesDistinctionResponse } from '../../index.js';

export class StatesDistinctionFinder {
    /** @type {DomainStatesDistinctionFinder} is initialized in the constructor */
    #finder;

    constructor(repository) {
        this.#finder = new DomainStatesDistinctionFinder(repository);
    }

    async execute() {
        const collection = await this.#finder.execute();
        return new StatesDistinctionResponse(collection);
    }
}
