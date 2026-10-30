import {
    CsvExportViewCreator,
    CsvExportViewDeleter,
    CsvExportViewFinder,
    CsvExportViewUpdater,
    CsvExportViewSearcher,
    CsvExportViewResponse,
    CsvExportViewCollectionResponse,
    CsvExportView,
    KnexCsvExportViewRepository,
} from '../../src/csv-export-views/index.js';
import CsvExportViewMother from './domain/CsvExportViewMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidV4 } from 'uuid';
import { CustomError } from '../../src/shared/index.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';
import { jest } from '@jest/globals';

describe('CsvExportView Integration Tests', () => {
    const repository = new KnexCsvExportViewRepository(knexConfig);

    // Creator y Updater validan las vistas pedidas contra getViews(), que resuelve
    // el esquema desde el tenant en contexto. Sin tenant la validacion revienta.
    beforeAll(() => {
        jest.spyOn(TenantContext, 'getTenant').mockReturnValue({
            id: { value: 'test-tenant' },
            db_schema: { value: 'public' },
        });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('should create a CsvExportView', async () => {
        const dto = CsvExportViewMother.dto();
        const csvExportViewCreator = new CsvExportViewCreator(repository);

        await csvExportViewCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing CsvExportView', async () => {
        const csvExportView = await CsvExportViewMother.create(repository);
        const csvExportViewFinder = new CsvExportViewFinder(repository);

        const result = await csvExportViewFinder.execute(csvExportView.id.value);

        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(CsvExportViewResponse);
    });

    it('can update an existing CsvExportView', async () => {
        const csvExportView = await CsvExportViewMother.create(repository);
        const csvExportViewUpdater = new CsvExportViewUpdater(repository);

        const newValues = { description: 'updated description' };
        await csvExportViewUpdater.execute(csvExportView.id.value, newValues);

        const result = await repository.find(csvExportView.id);

        expect(result).toBeInstanceOf(CsvExportView);
        expect(result.description.value).toBe(newValues.description);
    });

    it('can delete an existing CsvExportView', async () => {
        const csvExportView = await CsvExportViewMother.create(repository);
        const csvExportViewDeleter = new CsvExportViewDeleter(repository);

        await csvExportViewDeleter.execute(csvExportView.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        });

        const result = await repository.find(csvExportView.id);
        expect(result).toBeInstanceOf(CsvExportView);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for CsvExportViews with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await CsvExportViewMother.create(repository);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const csvExportViewSearcher = new CsvExportViewSearcher(repository);

        const searchResult = await csvExportViewSearcher.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(CsvExportViewCollectionResponse);
    });

    it('should throw an error when creating an existing CsvExportView', async () => {
        const csvExportView = await CsvExportViewMother.create(repository);
        const csvExportViewCreator = new CsvExportViewCreator(repository);

        const dto = { ...CsvExportViewMother.dto(), id: csvExportView.id.value };
        await expect(csvExportViewCreator.execute(dto)).rejects.toThrow(
            new CustomError(`CsvExportView with id ${dto.id} already exists`)
        );
    });

    it('should return null when trying to find a CsvExportView with a non-existent ID', async () => {
        const csvExportViewFinder = new CsvExportViewFinder(repository);

        await expect(csvExportViewFinder.execute(uuidV4())).rejects.toThrow(CustomError);
    });

    it('should throw an error when trying to find a CsvExportView with a non-existent ID', async () => {
        const csvExportViewFinder = new CsvExportViewFinder(repository);

        await expect(csvExportViewFinder.execute(uuidV4())).rejects.toThrow('CsvExportView not found');
    });

    it('should throw an error when creating a CsvExportView with invalid data', async () => {
        const dto = CsvExportViewMother.dto();
        delete dto.id;
        const csvExportViewCreator = new CsvExportViewCreator(repository);

        await expect(csvExportViewCreator.execute(dto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent CsvExportView', async () => {
        const csvExportViewUpdater = new CsvExportViewUpdater(repository);
        const newValues = { file_name: 'non_existent_file.csv' };
        const nonExistentId = uuidV4();

        await expect(csvExportViewUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `CsvExportView with ID ${nonExistentId} does not exist.`
        );
    });

    it('should not throw an error when deleting a non-existent CsvExportView', async () => {
        const csvExportViewDeleter = new CsvExportViewDeleter(repository);
        const nonExistentId = uuidV4();
        await expect(
            csvExportViewDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidV4(),
            })
        ).rejects.toThrow(`CsvExportView with ID ${nonExistentId} does not exist.`);
    });
});
