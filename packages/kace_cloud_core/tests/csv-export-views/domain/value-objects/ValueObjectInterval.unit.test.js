import { ValueObjectInterval } from '../../../../src/csv-export-views/domain/value-objects/ValueObjectInterval.js';
import { ValidationFailError } from '../../../../src/shared/index.js';

describe('ValueObjectInterval', () => {
    it('throws ValidationFailError when the value is missing and the field is not nullable', () => {
        expect(() => new ValueObjectInterval('interval', 0)).toThrow(ValidationFailError);
        expect(() => new ValueObjectInterval('interval', 0)).toThrow('The value cannot be null');
    });

    it('returns without validating when the value is missing but the field is nullable', () => {
        const vo = new ValueObjectInterval('interval', 0, true);
        expect(vo.value).toBe(0);
    });

    it('accepts a valid integer within [1, 365]', () => {
        const vo = new ValueObjectInterval('interval', 30);
        expect(vo.value).toBe(30);
    });

    it('throws when the value is out of the [1, 365] range', () => {
        expect(() => new ValueObjectInterval('interval', 400)).toThrow('The value must be between 1 and 365');
    });
});
