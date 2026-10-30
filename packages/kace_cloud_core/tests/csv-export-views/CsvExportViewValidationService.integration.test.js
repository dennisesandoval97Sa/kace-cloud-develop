import {
    CsvExportViewValidationService,
    KnexCsvExportViewRepository,
    ValueObjectViews,
} from '../../src/csv-export-views/index.js';
import { knexConfig } from '../knexfile.js';
import { ValidationFailError } from '../../src/shared/index.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';
import { jest } from '@jest/globals';

describe('CsvExportViewValidationService - Full Integration Tests', () => {
    const repository = new KnexCsvExportViewRepository(knexConfig);
    const service = new CsvExportViewValidationService(repository);

    // getViews() resuelve el esquema con TenantContext.getTenant().db_schema; sin
    // tenant en contexto toda validacion falla con QueryDBError antes de comparar.
    beforeAll(() => {
        jest.spyOn(TenantContext, 'getTenant').mockReturnValue({
            id: { value: 'test-tenant' },
            db_schema: { value: 'public' },
        });
    });

    beforeEach(async () => {
        await repository.connection.raw(`CREATE OR REPLACE VIEW view_casos_test AS SELECT 1 as test`);
        await repository.connection.raw(`CREATE OR REPLACE VIEW view_usuarios_test AS SELECT 1 as test`);
        await repository.connection.raw(`CREATE OR REPLACE VIEW view_transacciones_test AS SELECT 1 as test`);
    });

    afterAll(async () => {
        await repository.connection.raw(`DROP VIEW IF EXISTS view_casos_test;`);
        await repository.connection.raw(`DROP VIEW IF EXISTS view_usuarios_test;`);
        await repository.connection.raw(`DROP VIEW IF EXISTS view_transacciones_test;`);
    });

    describe('Validation of existing views', () => {
        it('should validate successfully when all views exist', async () => {
            const requestedViews = new ValueObjectViews('views', ['view_casos_test', 'view_usuarios_test']);
            await expect(service.execute(requestedViews)).resolves.toBe(true);
        });

        it('should accept a single valid view', async () => {
            const requestedViews = new ValueObjectViews('views', ['view_transacciones_test']);
            await expect(service.execute(requestedViews)).resolves.toBe(true);
        });
    });

    describe('Validation of non-existent views', () => {
        it('should throw an error when any view does not exist', async () => {
            const requestedViews = new ValueObjectViews('views', ['view_casos_test', 'view_inexistente']);
            await expect(service.execute(requestedViews)).rejects.toThrow(ValidationFailError);
        });

        it('should include invalid view names in the error message', async () => {
            const nonExistentViews = ['view_fantasma', 'view_imaginaria'];
            const requestedViews = new ValueObjectViews('views', ['view_casos_test', ...nonExistentViews]);

            try {
                await service.execute(requestedViews);
            } catch (error) {
                nonExistentViews.forEach((viewName) => {
                    expect(error.message).toContain(viewName);
                });
                expect(error.field).toBe('views');
            }
        });

        it('should be case-sensitive', async () => {
            const requestedViews = new ValueObjectViews('views', ['VIEW_CASOS_TEST']);
            await expect(service.execute(requestedViews)).rejects.toThrow(ValidationFailError);
        });
    });

    describe('Validation of input types', () => {
        it('should throw an error if ValueObjectViews is not received', async () => {
            const invalidInputs = [
                null,
                undefined,
                ['view_casos_test'],
                'view_casos_test',
                123,
                { value: ['view_casos_test'] },
            ];

            for (const input of invalidInputs) {
                await expect(service.execute(input)).rejects.toThrow(
                    'Invalid views parameter: must be a ValueObjectViews instance'
                );
            }
        });
    });
});
