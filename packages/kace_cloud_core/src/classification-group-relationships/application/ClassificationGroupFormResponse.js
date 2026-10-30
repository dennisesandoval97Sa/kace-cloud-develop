export class ClassificationGroupFormResponse {
    /** @type {ClassificationGroupRelationship} is initialized in the constructor */
    #classificationGroup;

    /**
     * Creates an instance of ClassificationGroupResponse.
     * @param {ClassificationGroupRelationship} classificationGroup - The ClassificationGroupRelationship instance.
     */
    constructor(classificationGroup) {
        this.#classificationGroup = classificationGroup;
    }

    /**
     * Converts the `ClassificationGroupRelationship` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the classification group relation data.
     */
    toJson() {
        if (!this.#classificationGroup) return {};

        return {
            data: {
                classification: this.#classificationGroup.classification.toJson().data,
                group: this.#classificationGroup.group.toJson().data,
                form: this.#classificationGroup.form.toJson().data,
            },
        };
    }
}
