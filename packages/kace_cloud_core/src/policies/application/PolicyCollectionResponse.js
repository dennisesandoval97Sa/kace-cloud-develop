import { PolicyResponse } from './PolicyResponse';

export class PolicyCollectionResponse {
    /** @type {Policy[]} is initialized in the constructor */
    #policies;
    /** @type {number} is initialized in the constructor */
    #count;
    constructor(policies, count) {
        this.#policies = policies;
        this.#count = count;
    }

    /**
     *
     * @returns {items: PolicyResponse[], count: number}
     */
    toJson() {
        return {
            data: {
                items: this.#policies.map((policy) => new PolicyResponse(policy).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
