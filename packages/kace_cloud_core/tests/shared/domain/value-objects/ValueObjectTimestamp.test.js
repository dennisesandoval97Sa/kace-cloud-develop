import { ValueObjectTimestamp } from '../../../../src/shared/index.js';

describe('ValueObjectTimeStamp', () => {
    it('should return the correct UTC string for a valid timestamp', () => {
        const value = '2023-10-01T00:00:00Z';
        const valueObject = new ValueObjectTimestamp('TestVO', value);
        expect(valueObject.value).toBe(new Date(value).toISOString());
    });

    it('should handle leap year dates correctly', () => {
        const value = '2024-02-29T00:00:00Z';
        const valueObject = new ValueObjectTimestamp('TestVO', value);
        expect(valueObject.value).toBe(new Date(value).toISOString());
    });

    it('should throw an error if the value is an empty string and nullable is false', () => {
        const value = '';
        expect(() => new ValueObjectTimestamp('TestVO', value, false)).toThrowError('The value cannot be null');
    });

    it('should create an instance with an empty string if nullable is true', () => {
        const value = '';
        const valueObject = new ValueObjectTimestamp('TestVO', value, true);
        expect(valueObject.value).toBe(null);
    });

    it('should throw an error if the value is not a valid timestamp', () => {
        const value = 'invalid-timestamp';
        expect(() => new ValueObjectTimestamp('TestVO', value)).toThrowError(
            'Invalid value Invalid Date for object timestamp'
        );
    });
});
