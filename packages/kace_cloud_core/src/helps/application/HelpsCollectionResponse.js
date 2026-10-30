import { HelpsResponse } from './HelpsResponse';

export class HelpsCollectionResponse {
    /**@type {Helps[]} is initialized in the constructor*/
    #helpsCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(helpsCollection, count) {
        this.#helpsCollection = helpsCollection;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#helpsCollection.map((helps) => new HelpsResponse(helps).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
