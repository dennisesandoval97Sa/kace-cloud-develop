import { ClassificationResponse } from './ClassificationResponse';

export class ClassificationCollectionResponse {
    /** @type {Classification[]} is initialized in the constructor */
    #classificationCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(classificationCollection, count) {
        this.#classificationCollection = classificationCollection;
        this.#count = count;
    }

    /**
     * Converts the Classification object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Classification data.
     */
    toJson() {
        return {
            data: {
                items: this.#classificationCollection.map(
                    (classification) => new ClassificationResponse(classification).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
