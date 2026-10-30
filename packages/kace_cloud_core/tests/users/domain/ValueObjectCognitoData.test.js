import { ValueObjectCognitoData } from '../../../src/users/domain/ValueObjectCognitoData.js';

describe('ValueObjectCognitoData', () => {
    it('accepts a non-empty string value (nullable defaulted, not passed)', () => {
        const vo = new ValueObjectCognitoData('a-cognito-hash');

        expect(vo.value).toBe('a-cognito-hash');
    });

    it('accepts a non-empty string value when nullable is explicitly false', () => {
        const vo = new ValueObjectCognitoData('a-cognito-hash', false);

        expect(vo.value).toBe('a-cognito-hash');
    });

    it('throws when the value is falsy and nullable is false', () => {
        expect(() => new ValueObjectCognitoData('', false)).toThrow('cognito_hash_data: The value cannot be null');
    });

    it('returns without a value when the value is falsy and nullable is true', () => {
        const vo = new ValueObjectCognitoData('', true);

        expect(vo.value).toBe('');
    });
});
