import { createSchema } from '../src/schemas.mjs';

describe('Quick Links - Schema Validation', () => {
    it('acepta un enlace válido', () => {
        const input = {
            title: 'Documentación KACE',
            url: 'https://example.com',
            position: 0,
        };

        const result = createSchema.validate(input);

        expect(result.error).toBeUndefined();
    });

    it('acepta crear sin posición', () => {
        const input = {
            title: 'Documentación',
            url: 'https://example.com',
        };

        const result = createSchema.validate(input);

        expect(result.error).toBeUndefined();
    });

    it('rechaza un título vacío', () => {
        const input = {
            title: '',
            url: 'https://example.com',
        };

        const result = createSchema.validate(input);

        expect(result.error).toBeDefined();
    });

    it('rechaza títulos superiores a 100 caracteres', () => {
        const input = {
            title: 'A'.repeat(101),
            url: 'https://example.com',
        };

        const result = createSchema.validate(input);

        expect(result.error).toBeDefined();
    });

    it('rechaza URLs con protocolo javascript', () => {
        const input = {
            title: 'Enlace inseguro',
            url: 'javascript:alert(1)',
        };

        const result = createSchema.validate(input);

        expect(result.error).toBeDefined();
    });

    it('rechaza URLs superiores a 500 caracteres', () => {
        const input = {
            title: 'Enlace largo',
            url: `https://example.com/${'a'.repeat(500)}`,
        };

        const result = createSchema.validate(input);

        expect(result.error).toBeDefined();
    });

    it('rechaza posiciones negativas', () => {
        const input = {
            title: 'Enlace',
            url: 'https://example.com',
            position: -1,
        };

        const result = createSchema.validate(input);

        expect(result.error).toBeDefined();
    });

    it('rechaza posiciones decimales', () => {
        const input = {
            title: 'Enlace',
            url: 'https://example.com',
            position: 1.5,
        };

        const result = createSchema.validate(input);

        expect(result.error).toBeDefined();
    });
});
