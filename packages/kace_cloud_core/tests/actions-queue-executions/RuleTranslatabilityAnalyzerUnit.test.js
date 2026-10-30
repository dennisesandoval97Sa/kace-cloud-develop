import { RuleTranslatabilityAnalyzer } from '../../src/actions/domain/QueryTranslator/RuleTranslatabilityAnalyzer.js';
import { CompositeRule } from '../../src/actions/domain/QueryTranslator/CompositeRule.js';
import { Rule } from '../../src/actions/domain/QueryTranslator/Rule.js';
import { createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';

const simpleRule = (field) =>
    Rule.fromValue({
        id: 'r',
        field,
        value: 'x',
        operator: '=',
        value_type: 'text',
    });

const composite = (combinator, rules) =>
    CompositeRule.fromValue({
        id: 'c',
        combinator,
        rules,
    });

describe('RuleTranslatabilityAnalyzer.extractSqlSubset (cases catalog)', () => {
    const analyzer = new RuleTranslatabilityAnalyzer(createCasesFieldCatalog());

    it('returns the rule when simple translatable', () => {
        const r = simpleRule('cases.responsable_id');
        expect(analyzer.extractSqlSubset(r)).toBe(r);
    });

    it('returns null when simple non-translatable (unknown prefix)', () => {
        const r = simpleRule('unknown.foo');
        expect(analyzer.extractSqlSubset(r)).toBeNull();
    });

    it('AND: drops untranslatable rules, keeps survivors', () => {
        const c = composite('and', [
            { id: 'r1', field: 'cases.responsable_id', value: 'a', operator: '=', value_type: 'text' },
            { id: 'r2', field: 'unknown.foo', value: 'b', operator: '=', value_type: 'text' },
        ]);
        const subset = analyzer.extractSqlSubset(c);
        expect(subset).not.toBeNull();
        expect(subset.rules.length).toBe(1);
    });

    it('OR: returns null when any child is untranslatable', () => {
        const c = composite('or', [
            { id: 'r1', field: 'cases.responsable_id', value: 'a', operator: '=', value_type: 'text' },
            { id: 'r2', field: 'unknown.foo', value: 'b', operator: '=', value_type: 'text' },
        ]);
        expect(analyzer.extractSqlSubset(c)).toBeNull();
    });
});

describe('RuleTranslatabilityAnalyzer.extractSqlSubset edge cases', () => {
    const analyzer = new RuleTranslatabilityAnalyzer(createCasesFieldCatalog());

    it('AND: returns null when ALL children are untranslatable', () => {
        const c = composite('and', [
            { id: 'r1', field: 'unknown.a', value: 'a', operator: '=', value_type: 'text' },
            { id: 'r2', field: 'unknown.b', value: 'b', operator: '=', value_type: 'text' },
        ]);
        expect(analyzer.extractSqlSubset(c)).toBeNull();
    });

    it('OR: returns CompositeRule with all children when all are translatable', () => {
        const c = composite('or', [
            { id: 'r1', field: 'cases.responsable_id', value: 'a', operator: '=', value_type: 'text' },
            { id: 'r2', field: 'cases.cliente_id', value: 'b', operator: '=', value_type: 'text' },
        ]);
        const subset = analyzer.extractSqlSubset(c);
        expect(subset).not.toBeNull();
        expect(subset.combinator.value).toBe('or');
        expect(subset.rules.length).toBe(2);
    });

    it('returns null when rule is an entity-type rule (field-to-field comparison not supported in SQL)', () => {
        const entityRule = Rule.fromValue({
            id: 'r',
            field: 'cases.responsable_id',
            value: 'cases.grupo_id',
            operator: '=',
            value_type: 'text',
            type: 'entity',
        });
        expect(analyzer.extractSqlSubset(entityRule)).toBeNull();
    });

    it('recurses into nested CompositeRule (AND inside OR)', () => {
        const inner = composite('and', [
            { id: 'r1', field: 'cases.responsable_id', value: 'a', operator: '=', value_type: 'text' },
            { id: 'r2', field: 'cases.cliente_id', value: 'b', operator: '=', value_type: 'text' },
        ]);
        const outer = composite('or', [
            { id: 'r3', field: 'cases.clasificacion_id', value: 'c', operator: '=', value_type: 'text' },
            inner.toJson(),
        ]);
        const subset = analyzer.extractSqlSubset(outer);
        expect(subset).not.toBeNull();
        expect(subset.combinator.value).toBe('or');
        expect(subset.rules.length).toBe(2);
    });
});
