import { Transitions } from '../../domain/Transitions';
import { TransitionsFinder } from '../../domain/TransitionsFinder.js';

export class TransitionCreator {
    /**
     *
     * @type {KnexTransitionsRepository} repository
     * is initialized in the constructor
     */
    #repository;

    /**
     * is initialized in the constructor
     * @typo {TransitionsFinder} finder
     */
    #finder;

    /**
     *
     * @param {KnexTransitionsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new TransitionsFinder(this.#repository);
    }

    /**
     *
     * @param {object} dtoTransition data for insert in database
     * @returns {Promise<void>}
     * @throws {Error} if dtoTransition is not valid
     * @throws {Error} if database connection fails
     */

    async execute(dtoTransition) {
        if (dtoTransition === null || dtoTransition === undefined) {
            throw new Error('dto cannot be null or undefined');
        }

        const transition = await this.#finder.execute(dtoTransition.id);
        if (transition) {
            const originalValues = transition.toJson();
            transition.update({
                ans_id: dtoTransition.ans_id,
                rule_id: dtoTransition.rule_id,
                updated_at: dtoTransition.updated_at,
                updated_by: dtoTransition.updated_by,
                is_visible: dtoTransition.is_visible,
            });

            await this.#repository.update(transition);
            await this.#repository.saveHistory(transition, originalValues);
            transition.flushChanges();
        } else {
            const newTransitions = new Transitions(dtoTransition);
            await this.#repository.save(newTransitions);
            await this.#repository.saveHistory(newTransitions);
            newTransitions.flushChanges();
        }
    }
}
