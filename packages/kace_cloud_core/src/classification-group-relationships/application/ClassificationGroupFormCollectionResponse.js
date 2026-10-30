import { ClassificationGroupFormResponse } from './ClassificationGroupFormResponse';

export class ClassificationGroupFormCollectionResponse {
    /** @type {ClassificationGroupRelationship[]} is initialized in the constructor */
    #classificationGroupFormCollection;

    /**
     * Creates an instance of ClassificationGroupCollectionResponse.
     * @param {ClassificationGroupRelationship[]} classificationGroupFormCollection - An array of ClassificationGroupRelationship instances.
     */
    constructor(classificationGroupFormCollection) {
        this.#classificationGroupFormCollection = classificationGroupFormCollection;
    }

    /**
     * Converts the Classification Group Relation object collection to a JSON representation.
     *
     * @returns {Object[]} A plain array containing the Classification Group Relation data in JSON format.
     */
    toJson() {
        return {
            data: {
                items: this.#classificationGroupFormCollection.map(
                    (classificationGroup) => new ClassificationGroupFormResponse(classificationGroup).toJson().data
                ),
            },
        };
    }
}
