import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import { Ans } from '../../src/ans/index.js';
import AnsMother from './domain/AnsMother.js';

describe('Ans visual allowlist validation', () => {
    it('creates an ANS with allowlisted colors', () => {
        const ans = Ans.create(AnsMother.dto());

        expect(ans.color_ans_inicial.value).toBe(AnsMother.dto().color_ans_inicial);
        expect(ans.color_ans_intermedio.value).toBe(AnsMother.dto().color_ans_intermedio);
        expect(ans.color_ans_final.value).toBe(AnsMother.dto().color_ans_final);
    });

    it('rejects manipulated ANS colors on create', () => {
        expect(() => Ans.create({ ...AnsMother.dto(), color_ans_inicial: '#FFFFFF' })).toThrow(
            new InvalidArgumentError('color_ans_inicial: Unsupported visual color #FFFFFF')
        );
    });

    it('rejects manipulated ANS colors on update', () => {
        const ans = Ans.create(AnsMother.dto());

        expect(() => ans.update({ color_ans_final: '#FFFFFF' })).toThrow(
            new InvalidArgumentError('color_ans_final: Unsupported visual color #FFFFFF')
        );
    });
});
