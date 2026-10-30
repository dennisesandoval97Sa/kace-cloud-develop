import { QuickLink, QuickLinkTitle, QuickLinkUrl, QuickLinkPosition } from '../../src/quick-links/domain/QuickLink.js';
import { QuickLinkMother } from './domain/QuickLinkMother.js';

describe('QuickLink - Domain', () => {
    it('crea un enlace válido', () => {
        const quickLink = QuickLinkMother.create();

        expect(quickLink).toBeInstanceOf(QuickLink);
        expect(quickLink.title.value).toBe('Documentación KACE');
        expect(quickLink.url.value).toBe('https://example.com/documentacion');
        expect(quickLink.position.value).toBe(0);
    });

    it('rechaza un título vacío', () => {
        expect(() => new QuickLinkTitle('')).toThrow();
        expect(() => new QuickLinkTitle('   ')).toThrow();
    });

    it('rechaza un título superior a 100 caracteres', () => {
        expect(() => new QuickLinkTitle('A'.repeat(101))).toThrow();
    });

    it('acepta URLs HTTP y HTTPS', () => {
        expect(new QuickLinkUrl('https://example.com').value).toBe('https://example.com');
        expect(new QuickLinkUrl('http://example.com').value).toBe('http://example.com');
    });

    it('rechaza protocolos inseguros', () => {
        expect(() => new QuickLinkUrl('javascript:alert(1)')).toThrow();
        expect(() => new QuickLinkUrl('ftp://example.com')).toThrow();
    });

    it('rechaza una URL superior a 500 caracteres', () => {
        expect(() => new QuickLinkUrl(`https://example.com/${'a'.repeat(500)}`)).toThrow();
    });

    it('valida posiciones válidas e inválidas', () => {
        expect(new QuickLinkPosition(0).value).toBe(0);
        expect(new QuickLinkPosition(5).value).toBe(5);
        expect(() => new QuickLinkPosition(-1)).toThrow();
        expect(() => new QuickLinkPosition(1.5)).toThrow();
    });

    it('convierte el agregado a valores primitivos', () => {
        const quickLink = QuickLinkMother.create();
        const result = quickLink.toPrimitives();

        expect(result.id).toBe(quickLink.id.value);
        expect(result.title).toBe('Documentación KACE');
        expect(result.position).toBe(0);
    });
});
