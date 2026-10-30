import { ValidationFailError, ValueObjectNameDefinition } from '../../../src/shared';

describe('ValueObjectNameDefinition', () => {
    const field = 'name';

    it('should create a valid snake_case lowercase name', () => {
        const value = 'valid_name_123';
        const name = new ValueObjectNameDefinition(field, value);
        expect(name.value).toBe(value);
    });

    it('should throw Error if null and not nullable', () => {
        expect(() => new ValueObjectNameDefinition(field, null)).toThrow(Error);
    });

    it('should not throw if null and nullable is true', () => {
        expect(() => new ValueObjectNameDefinition(field, null, true)).not.toThrow();
    });

    it('should throw ValidationFailError if too short', () => {
        expect(() => new ValueObjectNameDefinition(field, '')).toThrowError(
            'The value must be at least 3 characters long'
        );
    });

    it('should throw ValidationFailError if too long', () => {
        const value = 'a'.repeat(46);
        expect(() => new ValueObjectNameDefinition(field, value)).toThrowError(
            'The value must be at most 45 characters long'
        );
    });

    it('should throw ValidationFailError if contains uppercase letters', () => {
        expect(() => new ValueObjectNameDefinition(field, 'Invalid_Name')).toThrow(ValidationFailError);
    });

    it('should throw ValidationFailError if has special characters or accents', () => {
        expect(() => new ValueObjectNameDefinition(field, 'nombre_con_ñ')).toThrow(ValidationFailError);
        expect(() => new ValueObjectNameDefinition(field, 'nombre_con_á')).toThrow(ValidationFailError);
        expect(() => new ValueObjectNameDefinition(field, 'invalid@name')).toThrow(ValidationFailError);
    });

    it('should throw ValidationFailError if starts with a number', () => {
        expect(() => new ValueObjectNameDefinition(field, '1invalid')).toThrow(ValidationFailError);
    });

    it('should throw ValidationFailError if name is reserved', () => {
        expect(() => new ValueObjectNameDefinition(field, 'cases')).toThrow(ValidationFailError);
        expect(() => new ValueObjectNameDefinition(field, 'clients')).toThrow(ValidationFailError);
        expect(() => new ValueObjectNameDefinition(field, 'definitions')).toThrow(ValidationFailError);
    });
});
