import { RegexPatterns } from '../../../../src/shared';

describe('Regex', () => {
    test('onlyLetters should match only letters with accents and spaces', () => {
        const regex = RegexPatterns.onlyLetters();

        expect('Hola').toMatch(regex);
        expect('Éxito').toMatch(regex);
        expect('Árbol').toMatch(regex);
        expect('Hola Mundo').toMatch(regex);
    });

    test('Only letters not should accept special characters or numbers', () => {
        const regex = RegexPatterns.onlyLetters();
        expect('Hola123').not.toMatch(regex);
        expect('Hello!').not.toMatch(regex);
        expect('123').not.toMatch(regex);
        expect('Hola-Mundo').not.toMatch(regex);
    });

    test('descriptionRegex should match letters, numbers, spaces, and specific punctuation', () => {
        const regex = RegexPatterns.descriptionRegex();

        expect('Hola mundo 123').toMatch(regex);
        expect('Hola, mundo!').toMatch(regex);
        expect('Esto es una prueba.').toMatch(regex);
        expect('Descripción con - guion').toMatch(regex);
    });

    test('description regex not should accept special characters', () => {
        const regex = RegexPatterns.descriptionRegex();

        expect('Texto con @ símbolo').not.toMatch(regex);
        expect('Texto con $').not.toMatch(regex);
        expect('<tag>').not.toMatch(regex);
    });

    test('extendedHtmlRegex accepts emoji, currency symbols, degree signs and other content an enumerated whitelist would reject', () => {
        const regex = RegexPatterns.extendedHtmlRegex();

        expect('<p>¡Gracias! 🎉 Tu caso #123 fue resuelto ($0 costo adicional) °C</p>').toMatch(regex);
        expect('<table style="border-collapse:collapse;width:100%" border="0"></table>').toMatch(regex);
        expect('').toMatch(regex);
    });

    test('extendedHtmlRegex still rejects control characters (possible malformed/binary input)', () => {
        const regex = RegexPatterns.extendedHtmlRegex();

        expect('<p>Hola\x00mundo</p>').not.toMatch(regex);
        expect('<p>Hola\x1Fmundo</p>').not.toMatch(regex);
        expect('<p>Hola\x7Fmundo</p>').not.toMatch(regex);
    });
});
