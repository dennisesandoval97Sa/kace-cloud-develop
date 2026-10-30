export class PolicyResponse {
    /**
     * @type {Policy}
     * is initialized in the constructor
     */
    #policy;

    /**
     *
     * @param {Policy} policy
     */
    constructor(policy) {
        this.#policy = policy;
    }

    /**
     *
     * @returns {id: string, title: string, provider: string, effect: string, operations: string[], actions: string[], created_at: string, created_by: string, updated_at: string, updated_by: string}
     */
    toJson() {
        return {
            data: {
                id: this.#policy.id.value,
                title: this.#policy.title.value,
                provider: this.#policy.provider.value,
                effect: this.#policy.effect.value,
                operations: this.#policy.operations.value,
                actions: this.#policy.actions.value,
                created_at: this.#policy.created_at.value,
                created_by: this.#policy.created_by.value,
                updated_at: this.#policy.updated_at.value,
                updated_by: this.#policy.updated_by.value,
                deleted_at: this.#policy.deleted_at.value,
                deleted_by: this.#policy.deleted_by.value,
            },
        };
    }
}
