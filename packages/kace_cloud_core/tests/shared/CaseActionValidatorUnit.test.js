import dayjs from 'dayjs';
import { jest } from '@jest/globals';
import { CaseActionValidator } from '../../src/shared/domain/services/CaseActionValidator.js';

const fakeAction = (conditions, entityValue = 'case') => ({
    conditions: { value: conditions },
    entity: { value: entityValue },
});

const fakeEntity = {
    id: { value: 'c1' },
    toJson: () => ({ cases: { foo: 'bar' } }),
};

describe('CaseActionValidator.validateWithContext', () => {
    it('uses preloadedContext and never calls actionRepository.getCasoInfo', async () => {
        const spy = jest.fn();
        const validator = new CaseActionValidator({ getCasoInfo: spy });
        const preloaded = { cases: { foo: 'bar' } };
        const conditions = {
            id: 'c',
            combinator: 'and',
            rules: [{ id: 'r', field: 'cases.foo', value: 'bar', operator: '=', value_type: 'text' }],
        };
        const result = await validator.validateWithContext(fakeEntity, fakeAction(conditions), preloaded);
        expect(result).toBe(true);
        expect(spy).not.toHaveBeenCalled();
    });

    it('uses entity.toJson() when action.entity is not "case"', async () => {
        const spy = jest.fn();
        const validator = new CaseActionValidator({ getCasoInfo: spy });
        const conditions = {
            id: 'c',
            combinator: 'and',
            rules: [{ id: 'r', field: 'cases.foo', value: 'bar', operator: '=', value_type: 'text' }],
        };
        const result = await validator.validateWithContext(fakeEntity, fakeAction(conditions, 'user'), {});
        expect(result).toBe(true);
        expect(spy).not.toHaveBeenCalled();
    });

    it('threads opts.evaluationNow through to RuleValidator', async () => {
        const validator = new CaseActionValidator({ getCasoInfo: jest.fn() });
        const now = dayjs('2026-05-13T10:00:00Z');
        const conditions = {
            id: 'c',
            combinator: 'and',
            rules: [
                {
                    id: 'r',
                    field: 'cases.created_at',
                    value: 'datetime',
                    operator: '<',
                    value_type: 'date',
                    type: 'function',
                },
            ],
        };
        const preloaded = { cases: { created_at: '2026-05-13T09:00:00Z' } };
        const result = await validator.validateWithContext(fakeEntity, fakeAction(conditions), preloaded, {
            evaluationNow: now,
        });
        expect(result).toBe(true);
    });
});
