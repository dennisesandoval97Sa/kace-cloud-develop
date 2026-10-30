import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError';

export class RuleOperator {
    static EQUALS = '=';
    static NOT_EQUALS = '!=';
    static LESS_THAN = '<';
    static GREATER_THAN = '>';
    static LESS_THAN_EQUAL = '<=';
    static GREATER_THAN_EQUAL = '>=';
    static CONTAINS = 'contains';
    static BEGINS_WITH = 'beginsWith';
    static ENDS_WITH = 'endsWith';
    static DOES_NOT_CONTAIN = 'doesNotContain';
    static DOES_NOT_BEGIN_WITH = 'doesNotBeginWith';
    static DOES_NOT_END_WITH = 'doesNotEndWith';
    static NULL = 'null';
    static NOT_NULL = 'notNull';
    static IS_EMPTY = 'isEmpty';
    static IS_NOT_EMPTY = 'isNotEmpty';
    static IN = 'in';
    static NOT_IN = 'notIn';
    static BETWEEN = 'between';
    static NOT_BETWEEN = 'notBetween';

    /**
     *  @type {string}
     * is initialized in the constructor
     */
    #value;

    constructor(operator) {
        this.validate(operator);
        this.field = 'rule_operator';
        this.#value = operator;
        Object.freeze(this);
    }

    validate(operator) {
        if (!RuleOperator.isValid(operator)) {
            throw new InvalidArgumentError(`The rule operator ${operator} is not valid`);
        }
    }

    get value() {
        return this.#value ?? null;
    }

    static fromValue(value) {
        return new RuleOperator(value);
    }

    static isValid(operator) {
        return Object.values(RuleOperator).includes(operator);
    }
}
