import { KnexRepository } from '../../../../src/shared';
import { knexConfig } from '../../../knexfile.js';
import { TenantContext } from '../../../../src/shared/infrastructure/context/TenantContext.js';
import { jest } from '@jest/globals';

describe('KnexRepository Unit', () => {
    const repository = new KnexRepository(knexConfig);

    // getViews() lee el esquema desde el tenant en contexto; sin el, getTenant()
    // devuelve null y la consulta a information_schema.views nunca llega a correr.
    beforeAll(() => {
        jest.spyOn(TenantContext, 'getTenant').mockReturnValue({
            id: { value: 'test-tenant' },
            db_schema: { value: 'public' },
        });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('should get all schema tables', async () => {
        const tables = await repository.getSchemaTables();

        expect(Array.isArray(tables)).toBe(true);
        expect(tables.length).toBeGreaterThan(0);
        tables.forEach((table) => {
            expect(typeof table).toBe('string');
        });
        expect(tables).toEqual(expect.arrayContaining(['usuarios', 'clients']));
    });

    it('should get all views from schema', async () => {
        const views = await repository.getViews();

        expect(Array.isArray(views)).toBe(true);
        expect(views.length).toBeGreaterThan(0);

        views.forEach((view) => {
            expect(typeof view).toBe('string');
        });

        expect(views).toEqual(expect.arrayContaining([expect.any(String)]));
    });
});
