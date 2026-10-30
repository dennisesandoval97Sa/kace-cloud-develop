import { jest } from '@jest/globals';
import { EntityActionValidator } from '../../src/shared/domain/services/EntityActionValidator.js';

const makeAction = (conditions) => ({ conditions: { value: conditions } });
const trueCondition = { id: 'c', combinator: 'and', rules: [] };

const makeUser = (overrides = {}) => ({
    toJson: () => ({ id: 'u1', last_seen_at: null, ...overrides }),
    toRulesContext: (limit) => ({ id: 'u1', last_seen_at: 'false', activeSessionLimit: limit }),
});

describe('EntityActionValidator.validateWithContext', () => {
    it('calls toRulesContext with provided activeSessionLimit when resolvedContext present', async () => {
        const validator = new EntityActionValidator();
        const user = makeUser();
        const spy = jest.spyOn(user, 'toRulesContext');

        const result = await validator.validateWithContext(user, makeAction(trueCondition), { activeSessionLimit: 5 });

        expect(result).toBe(true);
        expect(spy).toHaveBeenCalledWith(5);
    });

    it('calls toRulesContext with no argument when resolvedContext is null', async () => {
        const validator = new EntityActionValidator();
        const user = makeUser();
        const spy = jest.spyOn(user, 'toRulesContext');

        await validator.validateWithContext(user, makeAction(trueCondition), null);

        expect(spy).toHaveBeenCalledWith();
    });

    it('falls back to toJson when entity has no toRulesContext (groups)', async () => {
        const validator = new EntityActionValidator();
        const group = { toJson: () => ({ id: 'g1', nombre: 'X' }) };
        const spy = jest.spyOn(group, 'toJson');

        const result = await validator.validateWithContext(group, makeAction(trueCondition), null);

        expect(result).toBe(true);
        expect(spy).toHaveBeenCalled();
    });
});
