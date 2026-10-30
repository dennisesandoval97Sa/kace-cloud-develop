import { TransitionRuleFinder } from '../../domain/TransitionRuleFinder.js';
import { CustomError } from '../../../shared/index.js';

export class TransitionRuleDeleter {
    /** @type {KnexTransitionRuleRepository} */
    #repository;

    /** @type {TransitionRuleFinder} */
    #finder;

    /**
     * @param {KnexTransitionRuleRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new TransitionRuleFinder(repository);
    }

    /**
     * @param {string} id
     * @param {Object} dto - Must include deleted_by and deleted_at
     * @returns {Promise<void>}
     */
    async execute(id, dto) {
        const transitionRule = await this.#finder.execute(id);

        if (!transitionRule) {
            throw new CustomError(`TransitionRule with ID ${id} does not exist.`, 404);
        }

        const originalValues = transitionRule.toJson ? transitionRule.toJson() : {};
        transitionRule.delete(dto);

        await this.#repository.update(transitionRule);
        await this.#repository.saveHistory(transitionRule, originalValues);
        transitionRule.flushChanges();
    }
}
