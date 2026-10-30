export class ClassificationResponse {
    /** @type {Classification} is initialized in the constructor */
    #classification;

    /**
     * Creates an instance of ClassificationResponse.
     * @param {Classification} classification - The Classification instance.
     */
    constructor(classification) {
        this.#classification = classification;
    }

    /**
     * Converts the Classification object to a JSON representation.
     *
     * @returns {Object} A flat object containing the classification data.
     */
    toJson() {
        if (!this.#classification) return {};

        const levels = {
            nivel1: this.#classification.nivel1.value,
            nivel2: this.#classification.nivel2.value,
            nivel3: this.#classification.nivel3.value,
            nivel4: this.#classification.nivel4.value,
            nivel5: this.#classification.nivel5.value,
            nivel6: this.#classification.nivel6.value,
            nivel7: this.#classification.nivel7.value,
            nivel8: this.#classification.nivel8.value,
            nivel9: this.#classification.nivel9.value,
            nivel10: this.#classification.nivel10.value,
        };

        return {
            data: {
                id: this.#classification.id.value,
                description: this.#classification.description,
                ...levels,
                flujo_id: this.#classification.flujo_id.value,
                ans_id: this.#classification.ans_id.value,
                external_id: this.#classification.external_id.value,
                default_group_id: this.#classification.default_group_id.value,
                folio_config_id: this.#classification.folio_config_id.value,
                is_active: this.#classification.is_active.value,
                can_start_sub_cases_flow: this.#classification.can_start_sub_cases_flow.value,
                json_flujo: this.#classification.json_flujo.value,
                relations: this.#classification.relations ?? this.#classification.getClassificationRelations(),
                created_at: this.#classification.created_at.value,
                updated_at: this.#classification.updated_at.value,
                created_by: this.#classification.created_by.value,
                updated_by: this.#classification.updated_by.value,
            },
        };
    }
}
