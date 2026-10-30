import { knexConfig } from '../knexfile.js';
import { KnexS3ImportFiles } from '../../src/imports/infrastructure/persistence/KnexS3ImportFiles.js';
import { ImportsDashboardSearcher } from '../../src/imports/application/imports-dashboard/search/ImportsDashboardSearcher.js';
import { ImportsDashboardSearchResponse } from '../../src/imports/application/ImportsDashboardSearchResponse.js';
import { S3ImportFile } from '../../src/imports/domain/S3ImportFile.js';
import { v4 as uuidv4 } from 'uuid';

const createValidDto = (overrides = {}) => ({
    id: uuidv4(),
    file_path: 'folder/test.csv',
    status: 'pending',
    upload_attempts: 0,
    total_records: 10,
    processed_records: 0,
    last_updated_at: new Date(),
    created_at: new Date(),
    created_by: uuidv4(),
    error_details: null,
    target_table: 'usuarios',
    ...overrides,
});

describe('ImportsDashboardSearcher - Integration Tests', () => {
    const repository = new KnexS3ImportFiles(knexConfig);
    const searcher = new ImportsDashboardSearcher(repository);

    describe('execute', () => {
        it('should return search results with correct count', async () => {
            const userId = uuidv4();
            const dto1 = createValidDto({ created_by: userId, status: 'pending' });
            const dto2 = createValidDto({ created_by: userId, status: 'completed' });
            const dto3 = createValidDto({ created_by: uuidv4(), status: 'pending' });

            const aggregate1 = S3ImportFile.create(dto1);
            const aggregate2 = S3ImportFile.create(dto2);
            const aggregate3 = S3ImportFile.create(dto3);

            await repository.save(aggregate1);
            await repository.save(aggregate2);
            await repository.save(aggregate3);

            const searchCriteria = {
                filter: [
                    {
                        field: 'created_by',
                        operator: 'eq',
                        value: userId,
                        type: 'and',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: undefined,
            };

            const result = await searcher.execute(searchCriteria);

            expect(result).toBeInstanceOf(ImportsDashboardSearchResponse);
            expect(Number(result.counter)).toBe(2);

            const jsonResult = result.toJson();
            expect(jsonResult.data.items).toHaveLength(2);
            expect(Number(jsonResult.metadata.count)).toBe(2);

            jsonResult.data.items.forEach((item) => {
                expect(item.created_by).toBe(userId);
            });
        });

        it('should filter by status correctly', async () => {
            const userId = uuidv4();
            const dto1 = createValidDto({ created_by: userId, status: 'pending' });
            const dto2 = createValidDto({ created_by: userId, status: 'completed' });
            const dto3 = createValidDto({ created_by: userId, status: 'error' });

            const aggregate1 = S3ImportFile.create(dto1);
            const aggregate2 = S3ImportFile.create(dto2);
            const aggregate3 = S3ImportFile.create(dto3);

            await repository.save(aggregate1);
            await repository.save(aggregate2);
            await repository.save(aggregate3);

            const searchCriteria = {
                filter: [
                    {
                        field: 'created_by',
                        operator: 'eq',
                        value: userId,
                        type: 'and',
                    },
                    {
                        field: 'status',
                        operator: 'eq',
                        value: 'pending',
                        type: 'and',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            const result = await searcher.execute(searchCriteria);

            expect(Number(result.counter)).toBe(1);

            const jsonResult = result.toJson();
            expect(jsonResult.data.items).toHaveLength(1);
            expect(jsonResult.data.items[0].status).toBe('pending');
            expect(Number(jsonResult.metadata.count)).toBe(1);
        });

        it('should scope rows and count with qualified panel filters plus the injected created_by filter', async () => {
            // Mirrors the real /imports-dashboard/search payload: the frontend sends
            // fields qualified as s3_import_files.<col> plus order, and the controller
            // appends the s3_import_files.created_by scoping filter after authorization.
            const userId = uuidv4();
            const dto1 = createValidDto({ created_by: userId, status: 'pending' });
            const dto2 = createValidDto({ created_by: userId, status: 'completed' });
            const dto3 = createValidDto({ created_by: uuidv4(), status: 'pending' });

            await repository.save(S3ImportFile.create(dto1));
            await repository.save(S3ImportFile.create(dto2));
            await repository.save(S3ImportFile.create(dto3));

            const searchCriteria = {
                filter: [
                    {
                        field: 's3_import_files.status',
                        operator: 'eq',
                        value: 'pending',
                        type: 'AND',
                    },
                    {
                        field: 's3_import_files.created_by',
                        operator: 'eq',
                        value: userId,
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 's3_import_files.created_at', direction: 'desc' },
            };

            const result = await searcher.execute(searchCriteria);

            expect(Number(result.counter)).toBe(1);

            const jsonResult = result.toJson();
            expect(jsonResult.data.items).toHaveLength(1);
            expect(jsonResult.data.items[0].status).toBe('pending');
            expect(jsonResult.data.items[0].created_by).toBe(userId);
            expect(Number(jsonResult.metadata.count)).toBe(1);
        });

        it('should handle pagination correctly', async () => {
            const userId = uuidv4();

            for (let i = 0; i < 5; i++) {
                const dto = createValidDto({
                    created_by: userId,
                    file_path: `file_${i}.csv`,
                });
                const aggregate = S3ImportFile.create(dto);
                await repository.save(aggregate);
            }

            const searchCriteria = {
                filter: [
                    {
                        field: 'created_by',
                        operator: 'eq',
                        value: userId,
                        type: 'and',
                    },
                ],
                relationship: null,
                limit: 2,
                offset: 1,
                order: { field: 'created_at', direction: 'desc' },
            };

            const result = await searcher.execute(searchCriteria);

            expect(Number(result.counter)).toBe(5);

            const jsonResult = result.toJson();
            expect(jsonResult.data.items).toHaveLength(2);
            expect(Number(jsonResult.metadata.count)).toBe(5);
        });

        it('should return empty results when no matches found', async () => {
            const dto = createValidDto({ created_by: uuidv4() });
            const aggregate = S3ImportFile.create(dto);
            await repository.save(aggregate);

            const searchCriteria = {
                filter: [
                    // `created_by` es `uuid` en postgres: una cadena que no lo
                    // sea aborta la consulta en vez de no devolver filas.
                    {
                        field: 'created_by',
                        operator: 'eq',
                        value: uuidv4(),
                        type: 'and',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            const result = await searcher.execute(searchCriteria);

            expect(result).toBeInstanceOf(ImportsDashboardSearchResponse);
            expect(Number(result.counter)).toBe(0);

            const jsonResult = result.toJson();
            expect(jsonResult.data.items).toEqual([]);
            expect(Number(jsonResult.metadata.count)).toBe(0);
        });

        it('should handle complex filtering', async () => {
            const userId = uuidv4();
            const targetTable = 'usuarios';

            const dto1 = createValidDto({
                created_by: userId,
                status: 'completed',
                target_table: targetTable,
                total_records: 100,
            });
            const dto2 = createValidDto({
                created_by: userId,
                status: 'completed',
                target_table: 'clientes',
                total_records: 50,
            });
            const dto3 = createValidDto({
                created_by: userId,
                status: 'pending',
                target_table: targetTable,
                total_records: 200,
            });

            const aggregate1 = S3ImportFile.create(dto1);
            const aggregate2 = S3ImportFile.create(dto2);
            const aggregate3 = S3ImportFile.create(dto3);

            await repository.save(aggregate1);
            await repository.save(aggregate2);
            await repository.save(aggregate3);

            const searchCriteria = {
                filter: [
                    {
                        field: 'created_by',
                        operator: 'eq',
                        value: userId,
                        type: 'and',
                    },
                    {
                        field: 'status',
                        operator: 'eq',
                        value: 'completed',
                        type: 'and',
                    },
                    {
                        field: 'target_table',
                        operator: 'eq',
                        value: targetTable,
                        type: 'and',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            const result = await searcher.execute(searchCriteria);

            expect(Number(result.counter)).toBe(1);

            const jsonResult = result.toJson();
            expect(jsonResult.data.items).toHaveLength(1);
            expect(jsonResult.data.items[0].status).toBe('completed');
            expect(jsonResult.data.items[0].target_table).toBe(targetTable);
            expect(Number(jsonResult.metadata.count)).toBe(1);
        });

        it('should handle ordering correctly', async () => {
            const userId = uuidv4();
            const baseDate = new Date('2024-01-01');

            const dto1 = createValidDto({
                created_by: userId,
                file_path: 'first.csv',
                created_at: new Date(baseDate.getTime()),
            });
            const dto2 = createValidDto({
                created_by: userId,
                file_path: 'second.csv',
                created_at: new Date(baseDate.getTime() + 1000),
            });
            const dto3 = createValidDto({
                created_by: userId,
                file_path: 'third.csv',
                created_at: new Date(baseDate.getTime() + 2000),
            });

            const aggregate1 = S3ImportFile.create(dto1);
            const aggregate2 = S3ImportFile.create(dto2);
            const aggregate3 = S3ImportFile.create(dto3);

            await repository.save(aggregate1);
            await repository.save(aggregate2);
            await repository.save(aggregate3);

            const searchCriteria = {
                filter: [
                    {
                        field: 'created_by',
                        operator: 'eq',
                        value: userId,
                        type: 'and',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'asc' },
            };

            const result = await searcher.execute(searchCriteria);

            const jsonResult = result.toJson();
            expect(jsonResult.data.items).toHaveLength(3);

            expect(jsonResult.data.items[0].file_path).toBe('first.csv');
            expect(jsonResult.data.items[1].file_path).toBe('second.csv');
            expect(jsonResult.data.items[2].file_path).toBe('third.csv');
        });
    });
});
