import { v4 as uuidv4 } from 'uuid';

import { StatusEnum } from '../../src/shared/index.js';
import { TransitionRule } from '../../src/transition-rules/domain/TransitionRule.js';
import { TransitionRuleResponse } from '../../src/transition-rules/application/TransitionRuleResponse.js';
import { TransitionRuleCollectionResponse } from '../../src/transition-rules/application/TransitionRuleCollectionResponse.js';
import { TransitionRuleMother } from './domain/TransitionRuleMother.js';

describe('TransitionRule domain tests', () => {
    it('should return a TransitionRule instance', () => {
        const dto = TransitionRuleMother.dto();
        const rule = TransitionRule.create(dto);

        expect(rule).toBeInstanceOf(TransitionRule);
        expect(rule.id.value).toEqual(dto.id);
        expect(rule.nombre.value).toEqual(dto.nombre);
        expect(rule.conditions.value).toEqual(dto.conditions);
        expect(rule.status.value).toEqual(dto.status);
        expect(rule.updated_at.value).toBeNull();
        expect(rule.updated_by.value).toBeNull();
    });

    it('should update nombre in a TransitionRule', () => {
        const dto = TransitionRuleMother.dto();
        const rule = TransitionRule.create(dto);

        const updateDto = {
            nombre: 'Nombre actualizado',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        rule.update(updateDto);

        expect(rule.nombre.value).toEqual(updateDto.nombre);
        expect(rule.updated_at.value).toEqual(updateDto.updated_at);
        expect(rule.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('should update conditions in a TransitionRule', () => {
        const dto = TransitionRuleMother.dto();
        const rule = TransitionRule.create(dto);

        const newConditions = {
            combinator: 'or',
            rules: [{ field: 'cases.status', operator: '=', value: '2', type: 'manual_input', value_type: 'text' }],
        };

        rule.conditions = newConditions;

        expect(rule.conditions.value).toEqual(newConditions);
        expect(rule.changedAttributes).toHaveProperty('conditions', newConditions);
    });

    it('should update status in a TransitionRule', () => {
        const dto = TransitionRuleMother.dto();
        const rule = TransitionRule.create(dto);

        rule.status = StatusEnum.INACTIVE.value;

        expect(rule.status.value).toEqual(StatusEnum.INACTIVE.value);
        expect(rule.changedAttributes).toHaveProperty('status', StatusEnum.INACTIVE.value);
    });

    it('does not update properties when values are the same', () => {
        const dto = TransitionRuleMother.dto();
        const rule = TransitionRule.create(dto);

        rule.update(dto);

        expect(rule.changedAttributes).toEqual({});
    });

    it('marks a TransitionRule instance as deleted', () => {
        const dto = TransitionRuleMother.dto();
        const rule = TransitionRule.create(dto);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        rule.delete(deleteDto);

        expect(rule.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(rule.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('flushes changed attributes after update', () => {
        const dto = TransitionRuleMother.dto();
        const rule = TransitionRule.create(dto);

        rule.update({
            nombre: 'Nuevo nombre',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        });
        rule.flushChanges();

        expect(rule.changedAttributes).toEqual({});
    });

    it('tracks nombre in changedAttributes when updated', () => {
        const dto = TransitionRuleMother.dto();
        const rule = TransitionRule.create(dto);

        rule.nombre = 'Nombre modificado';

        expect(rule.changedAttributes).toHaveProperty('nombre', 'Nombre modificado');
    });
});

describe('TransitionRule Response tests', () => {
    it('converts TransitionRule to JSON representation', () => {
        const dto = TransitionRuleMother.dto();
        const rule = new TransitionRule(dto);
        const response = new TransitionRuleResponse(rule);

        const json = response.toJson();

        expect(json).toEqual({
            data: {
                id: rule.id.value,
                nombre: rule.nombre.value,
                conditions: rule.conditions.value,
                status: rule.status.value,
                created_at: rule.created_at.value,
                created_by: rule.created_by.value,
                updated_at: rule.updated_at.value,
                updated_by: rule.updated_by.value,
            },
        });
    });

    it('returns an empty object if TransitionRule is null', () => {
        const response = new TransitionRuleResponse(null);

        expect(response.toJson()).toMatchObject({});
    });

    it('converts TransitionRule collection to JSON representation', () => {
        const rules = [new TransitionRule(TransitionRuleMother.dto()), new TransitionRule(TransitionRuleMother.dto())];
        const response = new TransitionRuleCollectionResponse(rules, rules.length);

        const json = response.toJson();

        expect(json).toEqual({
            data: {
                items: rules.map((r) => new TransitionRuleResponse(r).toJson().data),
            },
            metadata: {
                count: rules.length,
            },
        });
    });
});
