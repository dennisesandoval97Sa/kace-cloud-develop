import { CompositeRule } from './CompositeRule.js';
import { Rule } from './Rule.js';

const SUPPORTED_OPERATORS = new Set([
    '=',
    '!=',
    '<',
    '>',
    '<=',
    '>=',
    'contains',
    'beginsWith',
    'endsWith',
    'doesNotContain',
    'doesNotBeginWith',
    'doesNotEndWith',
    'in',
    'notIn',
    'between',
    'notBetween',
    'null',
    'notNull',
]);

export class RuleTranslatabilityAnalyzer {
    /** @param {import('./FieldCatalog.js').FieldCatalog} catalog */
    constructor(catalog) {
        if (!catalog) throw new Error('RuleTranslatabilityAnalyzer requires a catalog');
        this.catalog = catalog;
    }

    extractSqlSubset(node) {
        if (node instanceof Rule) {
            return this.#isSimpleTranslatable(node) ? node : null;
        }
        if (node instanceof CompositeRule) {
            const combinator = node.combinator.value;
            const children = node.rules.map((r) => this.extractSqlSubset(r));

            if (combinator === 'and') {
                const survivors = children.filter((c) => c !== null);
                if (survivors.length === 0) return null;
                return CompositeRule.fromValue({
                    id: node.id?.value ?? 'and-subset',
                    combinator: 'and',
                    rules: survivors.map((c) => c.toJson()),
                });
            }

            if (combinator === 'or') {
                if (children.some((c) => c === null)) return null;
                return CompositeRule.fromValue({
                    id: node.id?.value ?? 'or-subset',
                    combinator: 'or',
                    rules: children.map((c) => c.toJson()),
                });
            }
        }
        return null;
    }

    #isSimpleTranslatable(rule) {
        if (!SUPPORTED_OPERATORS.has(rule.operator?.value)) return false;
        const descriptor = this.catalog.resolve(rule.field?.value);
        if (!descriptor) return false;
        if (rule.type?.value === 'entity') return false;
        return true;
    }
}
