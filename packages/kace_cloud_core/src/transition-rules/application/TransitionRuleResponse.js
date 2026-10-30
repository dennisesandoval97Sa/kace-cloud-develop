export class TransitionRuleResponse {
    /**
     * @type {TransitionRule}
     */
    #transitionRule;

    /**
     * @param {TransitionRule} transitionRule
     */
    constructor(transitionRule) {
        this.#transitionRule = transitionRule;
    }

    toJson() {
        if (!this.#transitionRule) return {};

        return {
            data: {
                id: this.#transitionRule.id.value,
                nombre: this.#transitionRule.nombre.value,
                conditions: this.#transitionRule.conditions.value,
                status: this.#transitionRule.status.value,
                created_at: this.#transitionRule.created_at.value,
                created_by: this.#transitionRule.created_by.value,
                updated_at: this.#transitionRule.updated_at.value,
                updated_by: this.#transitionRule.updated_by.value,
            },
        };
    }
}
