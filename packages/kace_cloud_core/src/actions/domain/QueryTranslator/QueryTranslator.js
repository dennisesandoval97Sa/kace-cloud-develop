import { InvalidArgumentError } from '../../../shared/index.js';
import { RuleOperator } from './RuleOperator.js';
import { Rule } from './Rule.js';
import { CompositeRule } from './CompositeRule.js';
import { RuleValueCalculator } from './RuleValueCalculator.js';

export class QueryTranslator {
    /**
     * @param {{ catalog: import('./FieldCatalog.js').FieldCatalog, evaluationNow?: import('dayjs').Dayjs }} opts
     */
    constructor({ catalog, evaluationNow = null }) {
        if (!catalog) throw new InvalidArgumentError('QueryTranslator requires a catalog');
        this.catalog = catalog;
        this.evaluationNow = evaluationNow;
    }

    static escapeLikeValue(value) {
        return String(value).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    }

    buildQuery(knexQuery, queryRules, opts = {}) {
        if (typeof knexQuery !== 'object') throw new Error('A valid Knex instance must be provided.');
        if (!(queryRules instanceof CompositeRule))
            throw new InvalidArgumentError('queryRules must be an instance of CompositeRule');

        const baseTable = opts.baseTable ?? 'cases';
        const qualify = opts.qualify ?? ((table) => table);
        const tables = new Set();
        this.#collectReferencedTables(queryRules, tables);
        this.#applyJoinsForTables(knexQuery, tables, baseTable, qualify);
        knexQuery.where((sub) => this.#processRuleGroup(sub, queryRules));
        return knexQuery;
    }

    #collectReferencedTables(node, acc) {
        if (node instanceof Rule) {
            const d = this.catalog.resolve(node.field.value);
            if (d) acc.add(d.table);
            if (node.type?.value === 'entity') {
                const rhs = this.catalog.resolve(node.value.value);
                if (rhs) acc.add(rhs.table);
            }
        } else if (node instanceof CompositeRule) {
            for (const child of node.rules) this.#collectReferencedTables(child, acc);
        }
    }

    #applyJoinsForTables(query, tables, baseTable, qualify = (table) => table) {
        const joins = this.catalog.describeJoins(tables, baseTable);
        for (const join of joins) {
            // Qualify only the physical JOIN target ("schema"."table"); the ON-clause columns
            // keep the bare relation alias.
            query.leftJoin(qualify(join.table), join.on[0], join.on[1]);
        }
    }

    #processRuleGroup(knexQuery, compositeRule) {
        if (!(compositeRule instanceof CompositeRule))
            throw new InvalidArgumentError('compositeRule must be an instance of CompositeRule');
        const { combinator, rules } = compositeRule;
        rules.forEach((rule) => {
            if (rule instanceof CompositeRule) {
                knexQuery[combinator.value === 'and' ? 'andWhere' : 'orWhere']((sub) => {
                    this.#processRuleGroup(sub, rule);
                });
            } else if (combinator.value === 'or') {
                knexQuery.orWhere((b) => this.processRule(b, rule));
            } else {
                this.processRule(knexQuery, rule);
            }
        });
        return knexQuery;
    }

    processRule(knexQuery, rule) {
        if (typeof knexQuery !== 'object') throw new Error('A valid Knex instance must be provided.');
        if (!(rule instanceof Rule)) throw new InvalidArgumentError('rule must be an instance of Rule');

        const descriptor = this.catalog.resolve(rule.field.value);
        if (!descriptor) throw new InvalidArgumentError(`Untranslatable field: ${rule.field.value}`);

        const columnExpr = this.catalog.columnExpression(descriptor);
        const operator = rule.operator.value;
        const valueType = rule.value_type?.value ?? rule.valueType ?? 'text';
        const ruleValue = RuleValueCalculator.calculate(
            rule.value,
            rule.type ?? { value: 'value' },
            {},
            { evaluationNow: this.evaluationNow }
        );

        const castedColumn = this.#castColumnForValueType(columnExpr, valueType, descriptor);

        const splitValues = (v) =>
            Array.isArray(v)
                ? v
                : String(v)
                      .split(',')
                      .map((x) => x.trim());

        switch (operator) {
            case RuleOperator.EQUALS:
                return knexQuery.whereRaw(`${castedColumn} = ?`, [this.#castValue(ruleValue, valueType)]);
            case RuleOperator.NOT_EQUALS:
                return knexQuery.whereRaw(`${castedColumn} <> ?`, [this.#castValue(ruleValue, valueType)]);
            case RuleOperator.LESS_THAN:
                return knexQuery.whereRaw(`${castedColumn} < ?`, [this.#castValue(ruleValue, valueType)]);
            case RuleOperator.GREATER_THAN:
                return knexQuery.whereRaw(`${castedColumn} > ?`, [this.#castValue(ruleValue, valueType)]);
            case RuleOperator.LESS_THAN_EQUAL:
                return knexQuery.whereRaw(`${castedColumn} <= ?`, [this.#castValue(ruleValue, valueType)]);
            case RuleOperator.GREATER_THAN_EQUAL:
                return knexQuery.whereRaw(`${castedColumn} >= ?`, [this.#castValue(ruleValue, valueType)]);

            case RuleOperator.CONTAINS:
                return knexQuery.whereRaw(`${castedColumn} LIKE ?`, [
                    `%${QueryTranslator.escapeLikeValue(ruleValue)}%`,
                ]);
            case RuleOperator.BEGINS_WITH:
                return knexQuery.whereRaw(`${castedColumn} LIKE ?`, [`${QueryTranslator.escapeLikeValue(ruleValue)}%`]);
            case RuleOperator.ENDS_WITH:
                return knexQuery.whereRaw(`${castedColumn} LIKE ?`, [`%${QueryTranslator.escapeLikeValue(ruleValue)}`]);
            case RuleOperator.DOES_NOT_CONTAIN:
                return knexQuery.whereRaw(`${castedColumn} NOT LIKE ?`, [
                    `%${QueryTranslator.escapeLikeValue(ruleValue)}%`,
                ]);
            case RuleOperator.DOES_NOT_BEGIN_WITH:
                return knexQuery.whereRaw(`${castedColumn} NOT LIKE ?`, [
                    `${QueryTranslator.escapeLikeValue(ruleValue)}%`,
                ]);
            case RuleOperator.DOES_NOT_END_WITH:
                return knexQuery.whereRaw(`${castedColumn} NOT LIKE ?`, [
                    `%${QueryTranslator.escapeLikeValue(ruleValue)}`,
                ]);

            case RuleOperator.IN: {
                const vs = splitValues(ruleValue).map((v) => this.#castValue(v, valueType));
                const placeholders = vs.map(() => '?').join(',');
                return knexQuery.whereRaw(`${castedColumn} IN (${placeholders})`, vs);
            }
            case RuleOperator.NOT_IN: {
                const vs = splitValues(ruleValue).map((v) => this.#castValue(v, valueType));
                const placeholders = vs.map(() => '?').join(',');
                return knexQuery.whereRaw(`${castedColumn} NOT IN (${placeholders})`, vs);
            }
            case RuleOperator.BETWEEN: {
                const vs = splitValues(ruleValue);
                if (vs.length !== 2) throw new InvalidArgumentError('BETWEEN operator requires exactly 2 values');
                return knexQuery.whereRaw(`${castedColumn} BETWEEN ? AND ?`, [
                    this.#castValue(vs[0], valueType),
                    this.#castValue(vs[1], valueType),
                ]);
            }
            case RuleOperator.NOT_BETWEEN: {
                const vs = splitValues(ruleValue);
                if (vs.length !== 2) throw new InvalidArgumentError('NOT_BETWEEN operator requires exactly 2 values');
                return knexQuery.whereRaw(`${castedColumn} NOT BETWEEN ? AND ?`, [
                    this.#castValue(vs[0], valueType),
                    this.#castValue(vs[1], valueType),
                ]);
            }
            case RuleOperator.NULL:
                return knexQuery.whereRaw(`${castedColumn} IS NULL`);
            case RuleOperator.NOT_NULL:
                return knexQuery.whereRaw(`${castedColumn} IS NOT NULL`);
            case RuleOperator.IS_EMPTY:
                return knexQuery.whereRaw(`${castedColumn} = ''`);
            case RuleOperator.IS_NOT_EMPTY:
                return knexQuery.whereRaw(`${castedColumn} <> ''`);
            default:
                throw new InvalidArgumentError(`Unsupported operator: ${operator}`);
        }
    }

    #castColumnForValueType(columnExpr, valueType, descriptor) {
        if (descriptor.kind !== 'jsonPath') return columnExpr;
        // A present-but-empty JSON value ("") makes the ::timestamptz / ::numeric cast
        // throw `invalid input syntax`, which aborts the whole prefilter query and forces
        // EntityCandidateFinder to degrade to NO_PREFILTER. NULLIF(expr, '') turns "" into
        // NULL so the comparison is simply false instead of erroring.
        if (valueType === 'number') return `NULLIF(${columnExpr}, '')::numeric`;
        if (valueType === 'date') return `NULLIF(${columnExpr}, '')::timestamptz`;
        return columnExpr;
    }

    #castValue(value, valueType) {
        if (value === null || value === undefined) return value;
        if (valueType === 'number') {
            const n = Number(value);
            return Number.isNaN(n) ? null : n;
        }
        return String(value);
    }
}
