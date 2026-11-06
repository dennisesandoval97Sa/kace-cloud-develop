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

    it.each([null, undefined, 45])('rechaza títulos de tipo inválido: %s', (title) => {
        const createTitle = () => new QuickLinkTitle(title);

        expect(createTitle).toThrow('El título es obligatorio');
    });

    it('acepta un título de exactamente 100 caracteres y elimina espacios externos', () => {
        const title = 'A'.repeat(100);

        const result = new QuickLinkTitle(`  ${title}  `);

        expect(result.value).toBe(title);
    });

    it.each([null, undefined, 7, '   '])('rechaza una URL vacía o no textual: %s', (url) => {
        const createUrl = () => new QuickLinkUrl(url);

        expect(createUrl).toThrow('La URL es obligatoria');
    });

    it('acepta URL de 500 caracteres y elimina espacios externos', () => {
        const url = `https://example.com/${'a'.repeat(480)}`;

        const result = new QuickLinkUrl(` ${url} `);

        expect(result.value).toBe(url);
        expect(result.value).toHaveLength(500);
    });

    it('rechaza una URL HTTP sin un dominio válido', () => {
        const url = 'https://';

        const createUrl = () => new QuickLinkUrl(url);

        expect(createUrl).toThrow('La URL debe ser válida y utilizar HTTP o HTTPS');
    });

    it.each([null, undefined])('conserva como nula una posición ausente: %s', (position) => {
        const result = new QuickLinkPosition(position);

        expect(result.value).toBeNull();
    });

    it.each(['1', 0.5, {}, -1])('rechaza una posición fuera del contrato: %s', (position) => {
        const createPosition = () => new QuickLinkPosition(position);

        expect(createPosition).toThrow('La posición debe ser un entero mayor o igual a cero');
    });

    it('permite modificar título, URL y posición registrando atributos modificados', () => {
        const quickLink = QuickLinkMother.create();

        quickLink.title = '  Nuevo título  ';
        quickLink.url = ' https://example.org/actualizado ';
        quickLink.position = 3;

        expect(quickLink.title.value).toBe('Nuevo título');
        expect(quickLink.url.value).toBe('https://example.org/actualizado');
        expect(quickLink.position.value).toBe(3);
        expect(quickLink.changedAttributes).toEqual(
            expect.objectContaining({
                title: 'Nuevo título',
                url: 'https://example.org/actualizado',
                position: 3,
            })
        );
    });

    it('serializa la auditoría después de una modificación y eliminación lógica', () => {
        const quickLink = QuickLinkMother.create();
        const updatedAt = new Date('2026-11-01T10:00:00.000Z');
        const deletedAt = new Date('2026-11-02T10:00:00.000Z');
        const updatedBy = quickLink.created_by.value;
        const deletedBy = quickLink.created_by.value;

        quickLink.updated_at = updatedAt;
        quickLink.updated_by = updatedBy;
        quickLink.delete({ deleted_at: deletedAt, deleted_by: deletedBy });
        const result = quickLink.toPrimitives();

        expect(result.updated_at).toBe(updatedAt.toISOString());
        expect(result.updated_by).toBe(updatedBy);
        expect(result.deleted_at).toBe(deletedAt.toISOString());
        expect(result.deleted_by).toBe(deletedBy);
    });
});
