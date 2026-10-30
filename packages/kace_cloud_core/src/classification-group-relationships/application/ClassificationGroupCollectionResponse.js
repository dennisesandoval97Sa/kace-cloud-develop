import { ClassificationGroupResponse } from './ClassificationGroupResponse';

export class ClassificationGroupCollectionResponse {
    /** @type {ClassificationGroupRelationship[]} is initialized in the constructor */
    #classificationGroupCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of ClassificationGroupCollectionResponse.
     * @param {ClassificationGroupRelationship[]} classificationGroupCollection - An array of ClassificationGroupRelationship instances.
     */
    constructor(classificationGroupCollection, count) {
        this.#classificationGroupCollection = classificationGroupCollection;
        this.#count = count;
    }

    /**
     * Converts the Classification Group Relation object collection to a JSON representation.
     *
     * @returns {Object[]} A plain array containing the Classification Group Relation data in JSON format.
     */
    toJson() {
        return {
            data: {
                items: this.#classificationGroupCollection.map(
                    (classificationGroup) => new ClassificationGroupResponse(classificationGroup).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
