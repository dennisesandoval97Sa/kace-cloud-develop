import { TransitionRuleFinder as DomainTransitionRuleFinder } from '../../domain/TransitionRuleFinder.js';
import { TransitionRuleResponse } from '../TransitionRuleResponse.js';
import { CustomError } from '../../../shared/index.js';

export class TransitionRuleFinder {
    /** @type {DomainTransitionRuleFinder} */
    #finder;

    /** @type {import('../../../users').User} */
    #currentUser;

    /**
     * @param {KnexTransitionRuleRepository} repository
     * @param {import('../../../users').User} currentUser
     */
    constructor(repository, currentUser) {
        this.#finder = new DomainTransitionRuleFinder(repository);
        this.#currentUser = currentUser;
    }

    /**
     * @param {string} id
     * @returns {Promise<TransitionRuleResponse>}
     */
    async execute(id) {
        const transitionRule = await this.#finder.execute(id);
        if (!transitionRule || transitionRule.isDeleted()) {
            throw new CustomError('TransitionRule not found', 404);
        }

        return new TransitionRuleResponse(transitionRule);
    }
}
