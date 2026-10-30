import { QueryTranslator } from '../../src/actions/domain/QueryTranslator/QueryTranslator.js';
import { RuleOperator } from '../../src/actions/domain/QueryTranslator/RuleOperator';
import { CompositeRule } from '../../src/actions/domain/QueryTranslator/CompositeRule.js';
import { Rule } from '../../src/actions/domain/QueryTranslator/Rule.js';
import { KnexRepository } from '../../src/shared/index.js';
import { knexConfig } from '../knexfile.js';
import { createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError';

describe('QueryTranslator', () => {
    let knexQuery;
    let repository = new KnexRepository(knexConfig);

    beforeEach(() => {
        knexQuery = repository.connection('cases');
    });

    afterAll(async () => {
        await repository.destroyConnection();
    });

    describe('#processRule', () => {
        const queryTranslator = new QueryTranslator({ catalog: createCasesFieldCatalog() });

        it('should process EQUALS operator correctly', () => {
            const rule = Rule.fromValue({
                field: 'clients.tipo_documento',
                operator: RuleOperator.EQUALS,
                value: 'cc',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where clients.tipo_documento = 'cc'");
        });

        it('should throw error for invalid field', () => {
            const rule = Rule.fromValue({ field: 'invalid_field', operator: RuleOperator.EQUALS, value: 'active' });
            expect(() => queryTranslator.processRule(knexQuery, rule)).toThrow('Untranslatable field: invalid_field');
        });

        it('should handle LIKE operators correctly (CONTAINS)', () => {
            const rule = Rule.fromValue({ field: 'clients.nombres', operator: RuleOperator.CONTAINS, value: 'Juan' });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where clients.nombres LIKE '%Juan%'");
        });

        it('should throw error for BETWEEN with incorrect value', () => {
            const rule = Rule.fromValue({
                field: 'cases.antiguedad_dias',
                operator: RuleOperator.BETWEEN,
                value: '10',
            });
            expect(() => queryTranslator.processRule(knexQuery, rule)).toThrow(
                'BETWEEN operator requires exactly 2 values'
            );
        });

        it('should process BETWEEN operator correctly', () => {
            const rule = Rule.fromValue({
                field: 'cases.antiguedad_dias',
                operator: RuleOperator.BETWEEN,
                value: '10,20',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where cases.antiguedad_dias BETWEEN '10' AND '20'");
        });
    });

    describe('#buildQuery', () => {
        const queryTranslator = new QueryTranslator({ catalog: createCasesFieldCatalog() });

        it('should generate query with correct JOINs', () => {
            const queryRules = CompositeRule.fromValue({
                rules: [
                    { field: 'cases.estadoActual', operator: RuleOperator.EQUALS, value: 'active' },
                    { field: 'clients.nombres', operator: RuleOperator.CONTAINS, value: 'Juan' },
                ],
                combinator: 'and',
            });

            const builtQuery = queryTranslator.buildQuery(knexQuery, queryRules);
            expect(builtQuery.toQuery()).toBe(
                'select * from "cases" left join "clients" on "cases"."cliente_id" = "clients"."id" left join "transiciones" on "cases"."transicion_id" = "transiciones"."id" left join "estados" on "transiciones"."siguiente_estado_id" = "estados"."id" where (estados.id = \'active\' and clients.nombres LIKE \'%Juan%\')'
            );
        });

        it('should throw error if field is invalid and no join can be performed', () => {
            const queryRules = CompositeRule.fromValue({
                rules: [{ field: 'invalid_field', operator: RuleOperator.EQUALS, value: 'active' }],
                combinator: 'and',
            });
            expect(() => queryTranslator.buildQuery(knexQuery, queryRules).toQuery()).toThrow(
                'Untranslatable field: invalid_field'
            );
        });

        it('should correctly handle multiple conditions with AND/OR', () => {
            const compositeRules = CompositeRule.fromValue({
                combinator: 'and',
                rules: [
                    { field: 'cases.antiguedad_dias', operator: RuleOperator.EQUALS, value: '5' },
                    {
                        combinator: 'or',
                        rules: [
                            { field: 'clients.nombres', operator: RuleOperator.CONTAINS, value: 'Juan' },
                            { field: 'clients.apellido1', operator: RuleOperator.CONTAINS, value: 'Pérez' },
                        ],
                    },
                ],
            });

            const builtQuery = queryTranslator.buildQuery(knexQuery, compositeRules);
            expect(builtQuery.toQuery()).toContain(
                "((clients.nombres LIKE '%Juan%') or (clients.apellido1 LIKE '%Pérez%'))"
            );
        });
    });

    describe('#escapeLikeValue', () => {
        const queryTranslator = new QueryTranslator({ catalog: createCasesFieldCatalog() });

        it('should escape special LIKE characters', () => {
            const value = '100%_';
            const escapedValue = QueryTranslator.escapeLikeValue(value);
            expect(escapedValue).toBe('100\\%\\_');
        });
    });

    describe('constructor guard', () => {
        it('throws when no catalog is provided', () => {
            expect(() => new QueryTranslator({})).toThrow('QueryTranslator requires a catalog');
        });
    });

    describe('#buildQuery input guards', () => {
        const queryTranslator = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const validRules = CompositeRule.fromValue({
            rules: [{ field: 'cases.responsable_id', operator: RuleOperator.EQUALS, value: 'abc' }],
            combinator: 'and',
        });

        it('throws when knexQuery is not an object', () => {
            expect(() => queryTranslator.buildQuery('not-a-query-builder', validRules)).toThrow(
                'A valid Knex instance must be provided.'
            );
        });

        it('throws when queryRules is not a CompositeRule instance', () => {
            expect(() => queryTranslator.buildQuery(knexQuery, { rules: [] })).toThrow(InvalidArgumentError);
            expect(() => queryTranslator.buildQuery(knexQuery, { rules: [] })).toThrow(
                'queryRules must be an instance of CompositeRule'
            );
        });
    });

    describe('#processRule input guards', () => {
        const queryTranslator = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const validRule = Rule.fromValue({ field: 'cases.responsable_id', operator: RuleOperator.EQUALS, value: 'x' });

        it('throws when knexQuery is not an object', () => {
            expect(() => queryTranslator.processRule('not-a-query-builder', validRule)).toThrow(
                'A valid Knex instance must be provided.'
            );
        });

        it('throws when rule is not a Rule instance', () => {
            expect(() => queryTranslator.processRule(knexQuery, { field: 'x' })).toThrow(InvalidArgumentError);
            expect(() => queryTranslator.processRule(knexQuery, { field: 'x' })).toThrow(
                'rule must be an instance of Rule'
            );
        });
    });

    describe('#buildQuery entity-type rule table collection', () => {
        const queryTranslator = new QueryTranslator({ catalog: createCasesFieldCatalog() });

        // RuleOperator.NULL is used here (instead of EQUALS) because it is the only
        // operator whose SQL fragment (`IS NULL`) takes no binding. QueryTranslator always
        // resolves an entity-type rule's runtime value against an *empty* context ({}), so
        // `#castValue` receives `undefined`; any operator that binds that value (EQUALS,
        // CONTAINS, IN, ...) makes Knex's query compiler throw "Undefined binding(s)
        // detected" on `.toQuery()`. That looks like a real gap: QueryTranslator's own
        // entity-value calculation can never produce a usable comparison value, so entity
        // type rules only work today because RuleTranslatabilityAnalyzer (line 66) excludes
        // them from the SQL prefilter path entirely before buildQuery is ever called with
        // one. Reported as a candidate production bug, not fixed here.
        it('joins the table referenced by an entity-type rule value that resolves', () => {
            const queryRules = CompositeRule.fromValue({
                rules: [
                    {
                        field: 'cases.responsable_id',
                        operator: RuleOperator.NULL,
                        value: 'clasificaciones.id',
                        type: 'entity',
                    },
                ],
                combinator: 'and',
            });

            const builtQuery = queryTranslator.buildQuery(knexQuery, queryRules);
            expect(builtQuery.toQuery()).toContain('left join "clasificaciones"');
        });

        it('does not add a JOIN when an entity-type rule value does not resolve to a known field', () => {
            const queryRules = CompositeRule.fromValue({
                rules: [
                    {
                        field: 'cases.responsable_id',
                        operator: RuleOperator.NULL,
                        value: 'not_a_real_prefix.foo',
                        type: 'entity',
                    },
                ],
                combinator: 'and',
            });

            // If QueryTranslator ever dropped the `if (rhs) acc.add(rhs.table)` guard, this
            // would throw a TypeError (rhs is null here) instead of building the query.
            const builtQuery = queryTranslator.buildQuery(knexQuery, queryRules);
            expect(builtQuery.toQuery()).not.toContain('left join');
        });
    });

    describe('#processRule operator coverage (remaining operators)', () => {
        const queryTranslator = new QueryTranslator({ catalog: createCasesFieldCatalog() });

        it('translates NOT_EQUALS to <>', () => {
            const rule = Rule.fromValue({
                field: 'cases.responsable_id',
                operator: RuleOperator.NOT_EQUALS,
                value: 'abc',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where cases.responsable_id <> 'abc'");
        });

        it('translates LESS_THAN to <', () => {
            const rule = Rule.fromValue({
                field: 'cases.antiguedad_dias',
                operator: RuleOperator.LESS_THAN,
                value: '5',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where cases.antiguedad_dias < '5'");
        });

        it('translates GREATER_THAN to >', () => {
            const rule = Rule.fromValue({
                field: 'cases.antiguedad_dias',
                operator: RuleOperator.GREATER_THAN,
                value: '5',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where cases.antiguedad_dias > '5'");
        });

        it('translates GREATER_THAN_EQUAL to >=', () => {
            const rule = Rule.fromValue({
                field: 'cases.antiguedad_dias',
                operator: RuleOperator.GREATER_THAN_EQUAL,
                value: '5',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where cases.antiguedad_dias >= '5'");
        });

        it('translates LESS_THAN_EQUAL to <=', () => {
            const rule = Rule.fromValue({
                field: 'cases.antiguedad_dias',
                operator: RuleOperator.LESS_THAN_EQUAL,
                value: '5',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where cases.antiguedad_dias <= '5'");
        });

        it('translates BEGINS_WITH to a right-anchored LIKE', () => {
            const rule = Rule.fromValue({ field: 'clients.nombres', operator: RuleOperator.BEGINS_WITH, value: 'Jua' });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where clients.nombres LIKE 'Jua%'");
        });

        it('translates ENDS_WITH to a left-anchored LIKE', () => {
            const rule = Rule.fromValue({ field: 'clients.nombres', operator: RuleOperator.ENDS_WITH, value: 'an' });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where clients.nombres LIKE '%an'");
        });

        it('translates DOES_NOT_CONTAIN to NOT LIKE %value%', () => {
            const rule = Rule.fromValue({
                field: 'clients.nombres',
                operator: RuleOperator.DOES_NOT_CONTAIN,
                value: 'Juan',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where clients.nombres NOT LIKE '%Juan%'");
        });

        it('translates DOES_NOT_BEGIN_WITH to NOT LIKE value%', () => {
            const rule = Rule.fromValue({
                field: 'clients.nombres',
                operator: RuleOperator.DOES_NOT_BEGIN_WITH,
                value: 'Jua',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where clients.nombres NOT LIKE 'Jua%'");
        });

        it('translates DOES_NOT_END_WITH to NOT LIKE %value', () => {
            const rule = Rule.fromValue({
                field: 'clients.nombres',
                operator: RuleOperator.DOES_NOT_END_WITH,
                value: 'an',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where clients.nombres NOT LIKE '%an'");
        });

        it('translates NOT_IN with comma-split values', () => {
            const rule = Rule.fromValue({
                field: 'cases.alto_impacto',
                operator: RuleOperator.NOT_IN,
                value: 'a,b,c',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where cases.alto_impacto NOT IN ('a','b','c')");
        });

        it('translates NOT_BETWEEN with two values', () => {
            const rule = Rule.fromValue({
                field: 'cases.antiguedad_dias',
                operator: RuleOperator.NOT_BETWEEN,
                value: '10,20',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain("where cases.antiguedad_dias NOT BETWEEN '10' AND '20'");
        });

        it('throws for NOT_BETWEEN with a value count other than 2', () => {
            const rule = Rule.fromValue({
                field: 'cases.antiguedad_dias',
                operator: RuleOperator.NOT_BETWEEN,
                value: '10',
            });
            expect(() => queryTranslator.processRule(knexQuery, rule)).toThrow(
                'NOT_BETWEEN operator requires exactly 2 values'
            );
        });
    });

    describe('#processRule defensive fallback for an unsupported operator', () => {
        const queryTranslator = new QueryTranslator({ catalog: createCasesFieldCatalog() });

        it('throws when rule.operator.value does not match any known RuleOperator', () => {
            // RuleOperator itself refuses to be constructed with an invalid value, so no
            // Rule built through the public API can ever reach the switch's default arm.
            // This directly overwrites the (non-frozen) `operator` property on an otherwise
            // valid Rule instance to exercise that defensive fallback.
            const rule = Rule.fromValue({ field: 'cases.responsable_id', operator: RuleOperator.EQUALS, value: 'x' });
            rule.operator = { value: 'not_a_real_operator' };

            expect(() => queryTranslator.processRule(knexQuery, rule)).toThrow(InvalidArgumentError);
            expect(() => queryTranslator.processRule(knexQuery, rule)).toThrow(
                'Unsupported operator: not_a_real_operator'
            );
        });
    });

    describe('#processRule jsonPath column casting', () => {
        const queryTranslator = new QueryTranslator({ catalog: createCasesFieldCatalog() });

        it('wraps a jsonPath column with NULLIF(...)::numeric for valueType "number"', () => {
            const rule = Rule.fromValue({
                field: 'aux_cases.monto',
                operator: RuleOperator.GREATER_THAN,
                value: '100',
                value_type: 'number',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain(`NULLIF(aux_cases.data #>> '{monto}', '')::numeric > 100`);
        });

        it('wraps a jsonPath column with NULLIF(...)::timestamptz for valueType "date"', () => {
            const rule = Rule.fromValue({
                field: 'aux_cases.fecha',
                operator: RuleOperator.GREATER_THAN,
                value: '2026-01-01',
                value_type: 'date',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain(`NULLIF(aux_cases.data #>> '{fecha}', '')::timestamptz > '2026-01-01'`);
        });

        it('leaves a jsonPath column uncasted for valueType "text"', () => {
            const rule = Rule.fromValue({
                field: 'aux_cases.nombre',
                operator: RuleOperator.EQUALS,
                value: 'foo',
                value_type: 'text',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain(`aux_cases.data #>> '{nombre}' = 'foo'`);
            expect(query.toQuery()).not.toContain('NULLIF');
        });
    });

    describe('#processRule value casting for valueType "number"', () => {
        const queryTranslator = new QueryTranslator({ catalog: createCasesFieldCatalog() });

        it('casts a numeric string value to a JS number binding', () => {
            const rule = Rule.fromValue({
                field: 'cases.antiguedad_dias',
                operator: RuleOperator.EQUALS,
                value: '42',
                value_type: 'number',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain('where cases.antiguedad_dias = 42');
        });

        it('casts a non-numeric value to a NULL binding instead of NaN', () => {
            const rule = Rule.fromValue({
                field: 'cases.antiguedad_dias',
                operator: RuleOperator.EQUALS,
                value: 'not-a-number',
                value_type: 'number',
            });
            const query = queryTranslator.processRule(knexQuery, rule);
            expect(query.toQuery()).toContain('where cases.antiguedad_dias = NULL');
        });
    });

    describe('#processRuleGroup nested-group combinator selection', () => {
        const queryTranslator = new QueryTranslator({ catalog: createCasesFieldCatalog() });

        it('combines a nested group with orWhere when the parent combinator is "or"', () => {
            // #processRuleGroup picks andWhere/orWhere for a nested CompositeRule using the
            // *parent's* combinator (see QueryTranslator.js:63), not the nested group's own
            // combinator, so this requires an "or" parent to reach the orWhere branch.
            const queryRules = CompositeRule.fromValue({
                combinator: 'or',
                rules: [
                    { field: 'cases.responsable_id', operator: RuleOperator.EQUALS, value: 'r1' },
                    {
                        combinator: 'and',
                        rules: [
                            { field: 'cases.alto_impacto', operator: RuleOperator.EQUALS, value: 'a' },
                            { field: 'cases.vista', operator: RuleOperator.EQUALS, value: 'b' },
                        ],
                    },
                ],
            });

            const builtQuery = queryTranslator.buildQuery(knexQuery, queryRules);
            expect(builtQuery.toQuery()).toContain(
                "where ((cases.responsable_id = 'r1') or (cases.alto_impacto = 'a' and cases.vista = 'b'))"
            );
        });
    });
});
