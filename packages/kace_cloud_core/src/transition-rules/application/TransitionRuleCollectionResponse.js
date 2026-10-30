import { TransitionRuleResponse } from './TransitionRuleResponse.js';

export class TransitionRuleCollectionResponse {
    /**
     * @type {TransitionRule[]}
     */
    #transitionRules;

    /**
     * @type {number}
     */
    #count;

    /**
     * @param {TransitionRule[]} transitionRules
     * @param {number} count
     */
    constructor(transitionRules, count) {
        this.#transitionRules = transitionRules;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#transitionRules.map((rule) => new TransitionRuleResponse(rule).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
