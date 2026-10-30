import { ValueObjectViews } from '../../../../src/csv-export-views/domain/value-objects/ValueObjectViews.js';
import { ValidationFailError } from '../../../../src/shared/index.js';

describe('ValueObjectViews', () => {
    it('throws when the value is missing and the field is not nullable', () => {
        expect(() => new ValueObjectViews('views', null)).toThrow('views: The value cannot be null');
    });

    it('returns without validating when the value is missing but the field is nullable', () => {
        const vo = new ValueObjectViews('views', null, true);
        expect(vo.value).toBeNull();
    });

    it('accepts a non-empty array of unique, word-character view names', () => {
        const vo = new ValueObjectViews('views', ['default', 'view_2']);
        expect(vo.value).toEqual(['default', 'view_2']);
    });

    it('throws ValidationFailError when a view name has non-word characters', () => {
        expect(() => new ValueObjectViews('views', ['valid', 'not a view!'])).toThrow(ValidationFailError);
    });

    it('throws ValidationFailError when a view name is duplicated', () => {
        expect(() => new ValueObjectViews('views', ['default', 'default'])).toThrow(ValidationFailError);
    });
});
