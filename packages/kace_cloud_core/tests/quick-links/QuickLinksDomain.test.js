import { QuickLink, QuickLinkTitle, QuickLinkUrl, QuickLinkPosition } from '../../src/quick-links/domain/QuickLink.js';
import { QuickLinkMother } from './domain/QuickLinkMother.js';

describe('QuickLink - Domain', () => {
    it('crea un enlace válido', () => {
        const dto = QuickLinkMother.dto();

        const quickLink = QuickLink.create(dto);

        expect(quickLink).toBeInstanceOf(QuickLink);
        expect(quickLink.title.value).toBe('Documentación KACE');
        expect(quickLink.url.value).toBe('https://example.com/documentacion');
        expect(quickLink.position.value).toBe(0);
        expect(quickLink.created_at.value).toBe(dto.created_at.toISOString());
    });

    it('rechaza un título vacío', () => {
        const invalidTitle = '';

        const act = () => new QuickLinkTitle(invalidTitle);

        expect(act).toThrow();
    });

    it('rechaza un título formado únicamente por espacios', () => {
        const invalidTitle = '   ';

        const act = () => new QuickLinkTitle(invalidTitle);

        expect(act).toThrow();
    });

    it('rechaza un título superior a 100 caracteres', () => {
        const invalidTitle = 'A'.repeat(101);

        const act = () => new QuickLinkTitle(invalidTitle);

        expect(act).toThrow();
    });

    it.each(['https://example.com', 'http://example.com'])('acepta URL válida: %s', (url) => {
        const input = url;

        const valueObject = new QuickLinkUrl(input);

        expect(valueObject.value).toBe(input);
    });

    it.each(['javascript:alert(1)', 'ftp://example.com'])('rechaza protocolo no permitido: %s', (url) => {
        const invalidUrl = url;

        const act = () => new QuickLinkUrl(invalidUrl);

        expect(act).toThrow();
    });

    it('rechaza una URL superior a 500 caracteres', () => {
        const invalidUrl = `https://example.com/${'a'.repeat(500)}`;

        const act = () => new QuickLinkUrl(invalidUrl);

        expect(act).toThrow();
    });

    it.each([0, 5])('acepta posición válida: %s', (position) => {
        const input = position;

        const valueObject = new QuickLinkPosition(input);

        expect(valueObject.value).toBe(input);
    });

    it.each([-1, 1.5])('rechaza posición inválida: %s', (position) => {
        const invalidPosition = position;

        const act = () => new QuickLinkPosition(invalidPosition);

        expect(act).toThrow();
    });

    it('permite posición opcional según el dominio actual', () => {
        const position = undefined;

        const valueObject = new QuickLinkPosition(position);

        expect(valueObject.value).toBeNull();
    });

    it('convierte el agregado a valores primitivos', () => {
        const quickLink = QuickLinkMother.create();

        const result = quickLink.toPrimitives();

        expect(result.id).toBe(quickLink.id.value);
        expect(result.title).toBe('Documentación KACE');
        expect(result.position).toBe(0);
        expect(result.created_at).toBe(quickLink.created_at.value);
    });
});
