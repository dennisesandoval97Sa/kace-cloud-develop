export class ClassificationGroupResponse {
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
                classification_id: this.#classificationGroup.classification_id.value,
                group_id: this.#classificationGroup.group_id.value,
                form: this.#classificationGroup.form.value,
                group: {
                    ...(this.#classificationGroup.nombre_grupo.value
                        ? { nombre: this.#classificationGroup.nombre_grupo.value }
                        : {}),
                },
                one_script: {
                    ...(this.#classificationGroup.nombre_one_script.value
                        ? { nombre: this.#classificationGroup.nombre_one_script.value }
                        : {}),
                },
            },
        };
    }
}
