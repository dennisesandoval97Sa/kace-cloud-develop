export class ClassificationTemplateResponse {
    /** @type {ClassificationTemplateRelations} is initialized in the constructor */
    #classificationTemplate;

    /**
     * Creates an instance of ClassificationTemplateResponse.
     * @param {ClassificationTemplateRelations} classificationTemplate - The ClassificationTemplateRelations instance.
     */
    constructor(classificationTemplate) {
        this.#classificationTemplate = classificationTemplate;
    }

    /**
     * Converts the `ClassificationTemplateRelations` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the classification-template relation data.
     */
    toJson() {
        if (!this.#classificationTemplate) return {};

        return {
            data: {
                classification_id: this.#classificationTemplate.classification_id.value,
                template_id: this.#classificationTemplate.template_id.value,
            },
        };
    }
}
