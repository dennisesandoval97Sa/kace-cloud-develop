import { randomUUID } from 'node:crypto';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { knexConfig, buildWriterConfig } from '../knexfile.js';
import { QuickLinkCreator } from '../../src/quick-links/application/create/QuickLinkCreator.js';
import { QuickLinksSearcher } from '../../src/quick-links/application/search/QuickLinksSearcher.js';
import { QuickLinkDeleter } from '../../src/quick-links/application/delete/QuickLinkDeleter.js';
import { KnexQuickLinksRepository } from '../../src/quick-links/infrastructure/persistence/KnexQuickLinksRepository.js';

describe('Quick Links - Integration', () => {
    const repository = new KnexQuickLinksRepository(knexConfig);

    const createLink = (overrides = {}) => {
        const dto = {
            title: `Quick Link ${randomUUID()}`,
            url: 'https://example.com',
            position: 0,
            created_by: randomUUID(),
            ...overrides,
        };
        return new QuickLinkCreator(repository).execute(dto);
    };

    it('crea y guarda un enlace en PostgreSQL', async () => {
        const title = `Enlace ${randomUUID()}`;

        const quickLink = await createLink({ title });
        const rows = await repository.connection('quick_links').where({ id: quickLink.id.value }).select('*');

        expect(rows).toHaveLength(1);
        expect(rows[0].title).toBe(title);
        expect(rows[0].created_at).not.toBeNull();
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

    it('respeta la posición recibida en la creación', async () => {
        const position = 10;

        const quickLink = await createLink({ position });

        expect(quickLink.position.value).toBe(position);
    });

    it('rechaza la creación con una URL inválida', async () => {
        const dto = { url: 'javascript:alert(1)' };

        const act = createLink(dto);

        await expect(act).rejects.toThrow();
    });

    it('rechaza la creación sin título', async () => {
        const dto = { title: '' };

        const act = createLink(dto);

        await expect(act).rejects.toThrow();
    });

    it('elimina lógicamente un enlace', async () => {
        const quickLink = await createLink();
        const deleter = new QuickLinkDeleter(repository);

        const deleted = await deleter.execute(quickLink.id.value, randomUUID());
        const rows = await repository.connection('quick_links').where({ id: quickLink.id.value }).select('*');
        const found = await repository.find(quickLink.id.value);

        expect(deleted).toBe(true);
        expect(rows).toHaveLength(1);
        expect(rows[0].deleted_at).not.toBeNull();
        expect(found).toBeNull();
    });

    it('no muestra enlaces eliminados en el listado', async () => {
        const quickLink = await createLink();
        const deleter = new QuickLinkDeleter(repository);
        const searcher = new QuickLinksSearcher(repository);
        await deleter.execute(quickLink.id.value, randomUUID());

        const result = await searcher.execute();

        expect(result.map((link) => link.id.value)).not.toContain(quickLink.id.value);
    });

    it('devuelve false al eliminar un enlace inexistente', async () => {
        const deleter = new QuickLinkDeleter(repository);
        const missingId = randomUUID();

        const result = await deleter.execute(missingId, randomUUID());

        expect(result).toBe(false);
    });

    it('encuentra un enlace activo por identificador', async () => {
        const created = await createLink();

        const found = await repository.find(created.id.value);

        expect(found).not.toBeNull();
        expect(found.id.value).toBe(created.id.value);
        expect(found.title.value).toBe(created.title.value);
    });

    it('devuelve cero como posición siguiente cuando la tabla no tiene enlaces activos', async () => {
        const next = await repository.nextPosition();

        expect(next).toBe(0);
    });

    it('calcula la siguiente posición a partir de la máxima registrada', async () => {
        const maximum = 999999;
        await createLink({ position: maximum });

        const next = await repository.nextPosition();

        expect(next).toBe(maximum + 1);
    });

    it('no vuelve a listar un enlace que fue eliminado lógicamente', async () => {
        const created = await createLink();
        const deleter = new QuickLinkDeleter(repository);
        await deleter.execute(created.id.value, randomUUID());

        const found = await repository.find(created.id.value);

        expect(found).toBeNull();
    });

    it.each([
        ['save', async (broken, link) => broken.save(link)],
        ['findAll', async (broken) => broken.findAll()],
        ['find', async (broken, link) => broken.find(link.id.value)],
        ['nextPosition', async (broken) => broken.nextPosition()],
        ['delete', async (broken, link) => broken.delete(link)],
    ])('transforma un error PostgreSQL en QueryDBError al ejecutar %s', async (name, operation) => {
        const link = await createLink();
        const broken = new KnexQuickLinksRepository({
            ...buildWriterConfig(),
            schema: 'quick_links_schema_inexistente',
        });

        let error;
        try {
            await operation(broken, link);
        } catch (caught) {
            error = caught;
        } finally {
            await broken.destroyConnection();
        }

        expect(error).toBeInstanceOf(QueryDBError);
    });
});
