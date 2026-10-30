import { ClassificationTemplateResponse } from './ClassificationTemplateResponse';

export class ClassificationTemplateCollectionResponse {
    /** @type {ClassificationTemplateRelations[]} is initialized in the constructor */
    #classificationTemplateCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(classificationTemplateCollection, count) {
        this.#classificationTemplateCollection = classificationTemplateCollection;
        this.#count = count;
    }

    /**
     * Converts the Classification Template Relation objects to a JSON representation.
     *
     * @returns {Object[]} An array of plain objects containing the Classification Template Relation data.
     */
    toJson() {
        return {
            data: {
                items: this.#classificationTemplateCollection.map(
                    (classificationTemplate) => new ClassificationTemplateResponse(classificationTemplate).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
