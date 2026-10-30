import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError';

export class RuleCombinator {
    static AND = 'and';
    static OR = 'or';

    /**
     * @type {string}
     * is initialized in the constructor
     */
    #value;

    constructor(combinator) {
        this.validate(combinator);
        this.#value = combinator;
        Object.freeze(this);
    }

    validate(combinator) {
        if (!RuleCombinator.isValid(combinator)) {
            throw new InvalidArgumentError(`The combinator ${combinator} is not valid`);
        }
    }

    get value() {
        return this.#value ?? null;
    }

    static fromValue(value) {
        return new RuleCombinator(value);
    }

    static isValid(combinator) {
        return Object.values(RuleCombinator).includes(combinator);
    }
}
