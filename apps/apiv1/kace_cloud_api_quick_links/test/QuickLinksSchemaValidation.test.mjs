import { createSchema } from '../src/schemas.mjs';

describe('Quick Links - Schema Validation', () => {
    it('acepta un enlace válido', () => {
        const result = createSchema.validate({
            title: 'Documentación KACE',
            url: 'https://example.com',
            position: 0,
        });

        expect(result.error).toBeUndefined();
    });

    it('acepta crear sin posición', () => {
        const result = createSchema.validate({
            title: 'Documentación',
            url: 'https://example.com',
        });

        expect(result.error).toBeUndefined();
    });

    it('rechaza un título vacío', () => {
        const result = createSchema.validate({
            title: '',
            url: 'https://example.com',
        });

        expect(result.error).toBeDefined();
    });

    it('rechaza títulos superiores a 100 caracteres', () => {
        const result = createSchema.validate({
            title: 'A'.repeat(101),
            url: 'https://example.com',
        });

        expect(result.error).toBeDefined();
    });

    it('rechaza URLs con protocolo javascript', () => {
        const result = createSchema.validate({
            title: 'Enlace inseguro',
            url: 'javascript:alert(1)',
        });

        expect(result.error).toBeDefined();
    });

    it('rechaza URLs superiores a 500 caracteres', () => {
        const result = createSchema.validate({
            title: 'Enlace largo',
            url: `https://example.com/${'a'.repeat(500)}`,
        });

        expect(result.error).toBeDefined();
    });

    it('rechaza posiciones negativas', () => {
        const result = createSchema.validate({
            title: 'Enlace',
            url: 'https://example.com',
            position: -1,
        });

        expect(result.error).toBeDefined();
    });

    it('rechaza posiciones decimales', () => {
        const result = createSchema.validate({
            title: 'Enlace',
            url: 'https://example.com',
            position: 1.5,
        });

        expect(result.error).toBeDefined();
    });
});
