import { jest } from '@jest/globals';
import { ValueObjectString } from '../../../../src/shared/domain/value-object/ValueObjectString.js';
import { ValueObjectJson } from '../../../../src/shared/domain/value-object/ValueObjectJson.js';
import { InvalidArgumentError } from '../../../../src/shared/errors/InvalidArgumentError.js';
import { Helper } from '../../../../src/shared/infrastructure/utils/Helper.js';

describe('Value objects under SQL_GUARD_MODE=observe', () => {
    let original;
    const userText = 'Necesito el reporte from ventas; order by fecha -- urgente';

    beforeEach(() => {
        original = process.env.SQL_GUARD_MODE;
        jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        jest.spyOn(Helper, 'logMetric').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (original === undefined) {
            delete process.env.SQL_GUARD_MODE;
        } else {
            process.env.SQL_GUARD_MODE = original;
        }
    });

    it('enforce: ValueObjectString rejects text with prohibited words', () => {
        delete process.env.SQL_GUARD_MODE;
        expect(() => new ValueObjectString('descripcion', userText)).toThrow(InvalidArgumentError);
    });

    it('observe: ValueObjectString accepts and keeps the ORIGINAL value intact', () => {
        process.env.SQL_GUARD_MODE = 'observe';
        const vo = new ValueObjectString('descripcion', userText);
        expect(vo.value).toBe(userText);
    });

    it('observe: ValueObjectJson accepts a payload with prohibited words and keeps it intact', () => {
        process.env.SQL_GUARD_MODE = 'observe';
        const payload = { comment: userText, nested: { note: "client said 'order by date'" } };
        const vo = new ValueObjectJson('payload', payload);
        expect(vo.value).toEqual(payload);
    });
});
