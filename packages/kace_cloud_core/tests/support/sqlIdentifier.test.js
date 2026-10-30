import { describe, expect, test } from '@jest/globals';
import { quoteIdentifier, quoteQualified } from './sqlIdentifier.js';

describe('quoteIdentifier', () => {
    test('cita un identificador simple', () => {
        expect(quoteIdentifier('usuarios')).toBe('"usuarios"');
    });

    test('cita un identificador con guion, que es el caso de one-script', () => {
        expect(quoteIdentifier('one-script')).toBe('"one-script"');
    });

    test('rechaza un identificador con comilla doble', () => {
        expect(() => quoteIdentifier('mal"nombre')).toThrow(/Identificador SQL invalido/);
    });

    test('rechaza un identificador con punto y coma', () => {
        expect(() => quoteIdentifier('usuarios; drop table usuarios')).toThrow(/Identificador SQL invalido/);
    });

    test('rechaza la cadena vacia', () => {
        expect(() => quoteIdentifier('')).toThrow(/Identificador SQL invalido/);
    });

    test('rechaza null', () => {
        expect(() => quoteIdentifier(null)).toThrow(/Identificador SQL invalido/);
    });

    test('rechaza undefined', () => {
        expect(() => quoteIdentifier(undefined)).toThrow(/Identificador SQL invalido/);
    });

    test('rechaza un numero', () => {
        expect(() => quoteIdentifier(123)).toThrow(/Identificador SQL invalido/);
    });
});

describe('quoteQualified', () => {
    test('cita esquema y tabla por separado', () => {
        expect(quoteQualified('public', 'one-script')).toBe('"public"."one-script"');
    });

    test('rechaza un esquema invalido', () => {
        expect(() => quoteQualified('pu"blic', 'usuarios')).toThrow(/Identificador SQL invalido/);
    });

    test('rechaza una tabla invalida', () => {
        expect(() => quoteQualified('public', 'mal"nombre')).toThrow(/Identificador SQL invalido/);
    });
});
