import { TransitionRule } from '../../domain/TransitionRule.js';
import { TransitionRuleFinder } from '../../domain/TransitionRuleFinder.js';
import { CustomError, UniquenessValidator } from '../../../shared/index.js';

export class TransitionRuleCreator {
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
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    async execute(dto) {
        if (!dto) throw new Error('dto cannot be null or undefined');

        const transitionRule = TransitionRule.create(dto);

        const result = await this.#finder.execute(transitionRule.id.value);
        if (result) {
            throw new CustomError(`TransitionRule with id ${transitionRule.id.value} already exists`, 400);
        }

        await this.#uniquenessValidator.validate('nombre', dto.nombre);

        await this.#repository.save(transitionRule);
        await this.#repository.saveHistory(transitionRule);
    }
}
