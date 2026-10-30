import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError';
import { Rule } from './Rule';
import { RuleCombinator } from './RuleCombinator';

export class CompositeRule {
    /**
     * Construcs a new instance of CompositeRule
     * @param {Array<Rule|CompositeRule>} rules
     * @param {RuleCombinator} combinator
     */
    constructor(rules, combinator) {
        this.validate(rules, combinator);
        this.rules = rules;
        this.combinator = combinator;
        Object.freeze(this);
    }

    /**
     * Validates that the input rules and combinator are correct
     * @param {Array} rules - The array of rules to validate
     * @param {RuleCombinator} combinator - The combinator to validate
     */
    validate(rules, combinator) {
        if (!Array.isArray(rules)) {
            throw new InvalidArgumentError('Rules must be an array of instances of Rule or CompositeRule');
        }

        const allRulesValid = rules.every((rule) => rule instanceof Rule || rule instanceof CompositeRule);

        if (!allRulesValid) {
            throw new InvalidArgumentError('Rules must be an array of instances of Rule or CompositeRule');
        }

        if (!(combinator instanceof RuleCombinator)) {
            throw new InvalidArgumentError('Combinator must be an instance of RuleCombinator');
        }
    }

    /**
     * Creates a new CompositeRule instance from an input object
     * @param {Object} input - The object containing rules and the combinator
     * @returns {CompositeRule} - A new instance of CompositeRule
     */
    static fromValue(input) {
        if (typeof input !== 'object') {
            throw new InvalidArgumentError('Values for CompositeRule must be an object');
        }

        const { rules, combinator } = input;
        if (!Array.isArray(rules) || !combinator) {
            throw new InvalidArgumentError('CompositeRule must have an array of rules and a combinator');
        }

        const parsedCombinator = RuleCombinator.fromValue(combinator);
        const parsedRules = rules.map((ruleData) => {
            if (ruleData.rules) {
                return CompositeRule.fromValue(ruleData);
            }
            return Rule.fromValue(ruleData);
        });

        return new CompositeRule(parsedRules, parsedCombinator);
    }

    toJson() {
        return {
            combinator: this.combinator.value,
            rules: this.rules.map((r) => r.toJson()),
        };
    }
}
