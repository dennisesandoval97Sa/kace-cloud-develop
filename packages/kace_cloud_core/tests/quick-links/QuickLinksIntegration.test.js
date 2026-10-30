import { randomUUID } from 'node:crypto';
import { knexConfig } from '../knexfile.js';
import { QuickLinkCreator } from '../../src/quick-links/application/create/QuickLinkCreator.js';
import { QuickLinksSearcher } from '../../src/quick-links/application/search/QuickLinksSearcher.js';
import { QuickLinkDeleter } from '../../src/quick-links/application/delete/QuickLinkDeleter.js';
import { KnexQuickLinksRepository } from '../../src/quick-links/infrastructure/persistence/KnexQuickLinksRepository.js';

describe('Quick Links - Integration', () => {
    const repository = new KnexQuickLinksRepository(knexConfig);

    const createLink = async (overrides = {}) => {
        const creator = new QuickLinkCreator(repository);
        const title = `Quick Link ${randomUUID()}`;

        const dto = {
            title,
            url: 'https://example.com',
            created_by: randomUUID(),
            ...overrides,
        };

        return creator.execute(dto);
    };

    it('crea y guarda un enlace en PostgreSQL', async () => {
        const quickLink = await createLink();

        const rows = await repository.connection('quick_links').where({ id: quickLink.id.value }).select('*');

        expect(rows).toHaveLength(1);
        expect(rows[0].title).toBe(quickLink.title.value);
        expect(rows[0].deleted_at).toBeNull();
    });

    it('lista los enlaces activos ordenados por posición', async () => {
        const first = await createLink({ position: 2 });
        const second = await createLink({ position: 1 });

        const searcher = new QuickLinksSearcher(repository);
        const result = await searcher.execute();

        const ids = result.map((link) => link.id.value);

        expect(ids).toContain(first.id.value);
        expect(ids).toContain(second.id.value);
        expect(ids.indexOf(second.id.value)).toBeLessThan(ids.indexOf(first.id.value));
    });

    it('calcula automáticamente la siguiente posición', async () => {
        const first = await createLink({ position: 10 });
        const second = await createLink();

        expect(second.position.value).toBeGreaterThanOrEqual(first.position.value + 1);
    });

    it('rechaza la creación con una URL inválida', async () => {
        await expect(createLink({ url: 'javascript:alert(1)' })).rejects.toThrow();
    });

    it('rechaza la creación sin título', async () => {
        await expect(createLink({ title: '' })).rejects.toThrow();
    });

    it('elimina lógicamente un enlace', async () => {
        const quickLink = await createLink();
        const deleter = new QuickLinkDeleter(repository);

        const deleted = await deleter.execute(quickLink.id.value, randomUUID());

        expect(deleted).toBe(true);

        const rows = await repository.connection('quick_links').where({ id: quickLink.id.value }).select('*');

        expect(rows).toHaveLength(1);
        expect(rows[0].deleted_at).not.toBeNull();

        const found = await repository.find(quickLink.id.value);
        expect(found).toBeNull();
    });

    it('no muestra enlaces eliminados en el listado', async () => {
        const quickLink = await createLink();
        const deleter = new QuickLinkDeleter(repository);

        await deleter.execute(quickLink.id.value, randomUUID());

        const searcher = new QuickLinksSearcher(repository);
        const result = await searcher.execute();

        expect(result.map((link) => link.id.value)).not.toContain(quickLink.id.value);
    });

    it('devuelve false al intentar eliminar un enlace inexistente', async () => {
        const deleter = new QuickLinkDeleter(repository);
        const result = await deleter.execute(randomUUID(), randomUUID());

        expect(result).toBe(false);
    });
});
