import { RuleField } from '../../src/actions/domain/QueryTranslator/RuleField.js';
import { RuleOperator } from '../../src/actions/domain/QueryTranslator/RuleOperator.js';
import { RuleValue } from '../../src/actions/domain/QueryTranslator/RuleValue.js';
import { RuleType } from '../../src/actions/domain/QueryTranslator/RuleType.js';
import { Rule } from '../../src/actions/domain/QueryTranslator/Rule.js';
import { RuleCombinator } from '../../src/actions/domain/QueryTranslator/RuleCombinator.js';
import { CompositeRule } from '../../src/actions/domain/QueryTranslator/CompositeRule.js';
import { AuxCaseKeyCollector } from '../../src/actions-queue-executions/domain/services/AuxCaseKeyCollector.js';

const rule = (field) =>
    new Rule(
        new RuleField(field),
        new RuleOperator(RuleOperator.EQUALS),
        new RuleValue('Bogota'),
        RuleType.MANUAL_INPUT,
        'text'
    );

const entityRule = (field, value) =>
    new Rule(
        new RuleField(field),
        new RuleOperator(RuleOperator.EQUALS),
        new RuleValue(value),
        RuleType.ENTITY,
        'text'
    );

const manualRule = (field, value) =>
    new Rule(
        new RuleField(field),
        new RuleOperator(RuleOperator.EQUALS),
        new RuleValue(value),
        RuleType.MANUAL_INPUT,
        'text'
    );

const composite = (rules) => new CompositeRule(rules, new RuleCombinator('and'));

const action = (conditions) => ({ id: { value: 'a1' }, conditions: { value: conditions.toJson() } });

describe('AuxCaseKeyCollector', () => {
    it('collects the first segment after aux_cases. from every rule across actions', () => {
        const a1 = action(composite([rule('aux_cases.form1.ciudad'), rule('cases.estado')]));
        const a2 = action(composite([rule('aux_cases.datos_contacto.telefono')]));
        const keys = AuxCaseKeyCollector.collect([a1, a2]);
        expect(keys).toEqual(new Set(['form1', 'datos_contacto']));
    });

    it('recurses into nested composite rules', () => {
        const inner = composite([rule('aux_cases.anidado.x')]);
        const outer = composite([rule('aux_cases.top.y'), inner]);
        const keys = AuxCaseKeyCollector.collect([action(outer)]);
        expect(keys).toEqual(new Set(['top', 'anidado']));
    });

    it('returns null (=> project full data) when any rule references aux_cases with no sub-key', () => {
        const a = action(composite([rule('aux_cases')]));
        expect(AuxCaseKeyCollector.collect([a])).toBeNull();
    });

    it('returns an empty Set when no rule references aux_cases', () => {
        const a = action(composite([rule('cases.estado'), rule('clients.nombres')]));
        expect(AuxCaseKeyCollector.collect([a])).toEqual(new Set());
    });

    it('returns null when conditions cannot be parsed (degrade to full data)', () => {
        const bad = { id: { value: 'a1' }, conditions: { value: { not: 'a composite' } } };
        expect(AuxCaseKeyCollector.collect([bad])).toBeNull();
    });

    it('collects the key referenced by an entity-type rule value', () => {
        const a = action(composite([entityRule('cases.ciudad', 'aux_cases.form9.campo')]));
        const keys = AuxCaseKeyCollector.collect([a]);
        expect(keys).toEqual(new Set(['form9']));
    });

    it('returns null when an entity-type rule value is a bare aux_cases reference', () => {
        const a = action(composite([entityRule('cases.ciudad', 'aux_cases')]));
        expect(AuxCaseKeyCollector.collect([a])).toBeNull();
    });

    it('does not collect from a non-entity rule whose value merely looks like an aux_cases path', () => {
        const a = action(composite([manualRule('cases.estado', 'aux_cases.x.y')]));
        expect(AuxCaseKeyCollector.collect([a])).toEqual(new Set());
    });
});
