import { ValueObjectDetails } from '../../../../src/csv-export-views/domain/value-objects/ValueObjectDetails.js';
import { ValueObjectCsvFormatting } from '../../../../src/csv-export-views/domain/value-objects/ValueObjectCsvFormatting.js';
import { ValidationFailError } from '../../../../src/shared/index.js';

describe('ValueObjectDetails', () => {
    it('skips structure validation entirely when the value is falsy', () => {
        const vo = new ValueObjectDetails('details', null, true);
        expect(vo.value).toBeNull();
    });

    it('fills in a default formatting object when the value has none', () => {
        const vo = new ValueObjectDetails('details', { note: 'hello' }, true);
        expect(vo.value).toEqual({ note: 'hello', formatting: ValueObjectCsvFormatting.DEFAULT_VALUES });
    });

    it('accepts an explicit errors array', () => {
        const vo = new ValueObjectDetails('details', { errors: ['row 1 failed'] }, true);
        expect(vo.value.errors).toEqual(['row 1 failed']);
    });

    it('throws ValidationFailError when errors is present but not an array', () => {
        expect(() => new ValueObjectDetails('details', { errors: 'not-an-array' }, true)).toThrow(ValidationFailError);
        expect(() => new ValueObjectDetails('details', { errors: 'not-an-array' }, true)).toThrow(
            'details.errors must be an array if present'
        );
    });
});
