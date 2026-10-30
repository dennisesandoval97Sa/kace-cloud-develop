import { describe, it, expect } from '@jest/globals';
import { isValidIdentifier, assertValidIdentifier, quoteIdentifier } from '../../src/shared/identifier.js';

describe('identifier', () => {
    it('should accept plain snake_case identifiers', () => {
        expect(isValidIdentifier('clientes')).toBe(true);
        expect(isValidIdentifier('staging_asistencia')).toBe(true);
        expect(isValidIdentifier('_privado')).toBe(true);
        expect(isValidIdentifier('tabla2')).toBe(true);
    });

    it('should accept hyphenated identifiers that occur in the real KACE schema', () => {
        expect(isValidIdentifier('one-script')).toBe(true);
        expect(isValidIdentifier('history_one-script')).toBe(true);
    });

    it('should reject identifiers that could break out of the query', () => {
        expect(isValidIdentifier('clientes; drop table usuarios')).toBe(false);
        expect(isValidIdentifier('2tabla')).toBe(false);
        expect(isValidIdentifier('con espacio')).toBe(false);
        expect(isValidIdentifier('')).toBe(false);
        expect(isValidIdentifier(null)).toBe(false);
        expect(isValidIdentifier(123)).toBe(false);
    });

    it('should reject a leading hyphen', () => {
        // Sin otros guiones: aísla la regla de la posición inicial en vez de pasar por un guion embebido.
        expect(isValidIdentifier('-abc')).toBe(false);
    });

    it('should still reject anything that could escape the quoting', () => {
        expect(isValidIdentifier('a"b')).toBe(false);
        expect(isValidIdentifier('a";drop table x;--')).toBe(false);
        expect(isValidIdentifier('a\\b')).toBe(false);
    });

    it('should throw a labelled error when asserting an invalid identifier', () => {
        expect(() => assertValidIdentifier('drop;', 'schema')).toThrow('Invalid schema name: "drop;"');
    });

    it('should return the value when asserting a valid identifier', () => {
        expect(assertValidIdentifier('clientes', 'table')).toBe('clientes');
    });

    it('should quote a validated identifier', () => {
        expect(quoteIdentifier('clientes')).toBe('"clientes"');
    });

    it('should refuse to quote an invalid identifier', () => {
        expect(() => quoteIdentifier('a"b')).toThrow('Invalid identifier name');
    });
});
