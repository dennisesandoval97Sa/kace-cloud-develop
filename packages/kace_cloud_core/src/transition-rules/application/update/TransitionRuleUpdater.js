import { TransitionRuleFinder } from '../../domain/TransitionRuleFinder.js';
import { CustomError, UniquenessValidator } from '../../../shared/index.js';

export class TransitionRuleUpdater {
    /** @type {KnexTransitionRuleRepository} */
    #repository;

    /** @type {TransitionRuleFinder} */
    #finder;

    /** @type {UniquenessValidator} */
    #uniquenessValidator;

    /**
     * @param {KnexTransitionRuleRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new TransitionRuleFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * @param {string} id
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    async execute(id, dto) {
        const transitionRule = await this.#finder.execute(id);

        if (!transitionRule) {
            throw new CustomError(`TransitionRule with ID ${id} does not exist.`, 404);
        }

        const originalValues = transitionRule.toJson ? transitionRule.toJson() : {};
        transitionRule.update(dto);

        if (dto.nombre) {
            await this.#uniquenessValidator.validate('nombre', dto.nombre, id);
        }

        await this.#repository.update(transitionRule);
        await this.#repository.saveHistory(transitionRule, originalValues);
        transitionRule.flushChanges();
    }
}
