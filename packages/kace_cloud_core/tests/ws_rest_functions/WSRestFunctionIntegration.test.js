import { v4 as uuidv4 } from 'uuid';
import { WSRestFunction } from '../../src/ws_rest_functions/domain/WSRestFunction.js';
import { WSRestFunctionUpdater } from '../../src/ws_rest_functions/application/update/WSRestFunctionUpdater.js';
import { WSRestFunctionFinder } from '../../src/ws_rest_functions/application/find/WSRestFunctionFinder.js';
import { WSRestFunctionDeleter } from '../../src/ws_rest_functions/application/delete/WSRestFunctionDeleter.js';
import { WSRestFunctionSearcher } from '../../src/ws_rest_functions/application/search/WSRestFunctionSearcher.js';
import { WSRestFunctionResponse } from '../../src/ws_rest_functions/application/WSRestFunctionResponse.js';
import { WSRestFunctionCollectionResponse } from '../../src/ws_rest_functions/application/WSRestFunctionCollectionResponse.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { WSRestFunctionCreator } from '../../src/ws_rest_functions/application/create/WSRestFunctionCreator.js';
import { KnexWSRestFunctionRepository } from '../../src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository.js';
import { knexConfig } from '../knexfile.js';
import WSRestFunctionMother from './domain/WSRestFunctionMother.js';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';

const tenant = await new LocalTenantRepository().find();

describe('WSRestFunction Integration Tests', () => {
    const repository = new KnexWSRestFunctionRepository(knexConfig);

    describe('Creation', () => {
        it('should create a WSRestFunction', async () => {
            await TenantContext.run(tenant, async () => {
                const dto = WSRestFunctionMother.dto();
                const wsRestFunctionCreator = new WSRestFunctionCreator(repository);
                await wsRestFunctionCreator.execute(dto);
                const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);
                expect(result.length).toBe(1);
            });
        });
        it('should save WSRestFunction with correct values', async () => {
            await TenantContext.run(tenant, async () => {
                const dto = WSRestFunctionMother.dto();
                const wsRestFunctionCreator = new WSRestFunctionCreator(repository);
                await wsRestFunctionCreator.execute(dto);
                const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);
                expect(result[0]).toMatchObject({
                    id: dto.id,
                    description: dto.description,
                    type: dto.type,
                    filter_input: dto.filter_input,
                    context_position: dto.context_position,
                    value_static: dto.value_static,
                    value_dynamic: dto.value_dynamic,
                    is_active: dto.is_active,
                    created_by: dto.created_by,
                });
            });
        });

        it('should throw an error when creating an existing WSRestFunction', async () => {
            await TenantContext.run(tenant, async () => {
                const wsRestFunction = await WSRestFunctionMother.create(repository);
                const wsRestFunctionCreator = new WSRestFunctionCreator(repository);
                const dto = { ...WSRestFunctionMother.dto(), id: wsRestFunction.id.value };
                await expect(wsRestFunctionCreator.execute(dto)).rejects.toThrow(
                    new CustomError('RestFunction already exists.', 'id')
                );
            });
        });

        it('should throw an error when creating a WSRestFunction with invalid data', async () => {
            const wsRestFunctionCreator = new WSRestFunctionCreator(repository);
            await expect(wsRestFunctionCreator.execute(null)).rejects.toThrow(Error);
            const dto = WSRestFunctionMother.dto();
            delete dto.id;
            await expect(wsRestFunctionCreator.execute(dto)).rejects.toThrow();
        });

        it('should throw an error if filter_input has not structure', async () => {
            const wsRestFunctionCreator = new WSRestFunctionCreator(repository);
            const dto = WSRestFunctionMother.dto();
            dto.filter_input = [];
            await expect(wsRestFunctionCreator.execute(dto)).rejects.toThrow(
                'filter_input: The "filterInput" property must be an array and must have at least 0 element(s)'
            );
        });

        it('should throw QueryDBError when repository.save fails internally', async () => {
            await TenantContext.run(tenant, async () => {
                const dto = WSRestFunctionMother.dto();
                const repository = new KnexWSRestFunctionRepository(knexConfig);

                await expect(
                    repository.save({
                        ...new WSRestFunction(dto),
                        description: {
                            value: null,
                        },
                    })
                ).rejects.toThrow(QueryDBError);
            });
        });

        it('should throw QueryDBError when repository.update fails internally', async () => {
            await TenantContext.run(tenant, async () => {
                const dto = WSRestFunctionMother.dto();
                const repository = new KnexWSRestFunctionRepository(knexConfig);

                await expect(
                    repository.update({
                        ...new WSRestFunction(dto),
                        description: {
                            value: null,
                        },
                    })
                ).rejects.toThrow(QueryDBError);
            });
        });

        it('should create a WSRestFunction incremental function', async () => {
            await TenantContext.run(tenant, async () => {
                const dto = WSRestFunctionMother.dtoTypeIncrementAndStaticValueStringNumber();
                const wsRestFunctionCreator = new WSRestFunctionCreator(repository);
                await wsRestFunctionCreator.execute(dto);
                const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);
                expect(result.length).toBe(1);
            });
        });

        it('should create a WSRestFunction incremental function', async () => {
            await TenantContext.run(tenant, async () => {
                const dto = WSRestFunctionMother.dtoTypeIncrementAndStaticValueNumberInteger();
                const wsRestFunctionCreator = new WSRestFunctionCreator(repository);
                await wsRestFunctionCreator.execute(dto);
                const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);
                expect(result.length).toBe(1);
            });
        });

        it('should create a WSRestFunction incremental function', async () => {
            const dto = WSRestFunctionMother.dtoTypeIncrementAndStaticValueString();
            const wsRestFunctionCreator = new WSRestFunctionCreator(repository);
            await expect(wsRestFunctionCreator.execute(dto)).rejects.toThrow();
        });
    });

    describe('Retrieval', () => {
        it('should find an existing WSRestFunction by id', async () => {
            await TenantContext.run(tenant, async () => {
                const wsRestFunction = await WSRestFunctionMother.create(repository);
                const wsRestFunctionFinder = new WSRestFunctionFinder(repository);
                const result = await wsRestFunctionFinder.execute(wsRestFunction.id.value);
                expect(result).not.toBeNull();
                expect(result).toBeInstanceOf(WSRestFunctionResponse);
            });
        });

        it('should return null if record is not found', async () => {
            const wsRestFunctionFinder = new WSRestFunctionFinder(repository);
            await expect(wsRestFunctionFinder.execute(uuidv4())).resolves.toBeNull();
        });
    });

    describe('Updating', () => {
        it('should update an existing WSRestFunction', async () => {
            await TenantContext.run(tenant, async () => {
                const wsRestFunction = await WSRestFunctionMother.create(repository);
                const wsRestFunctionUpdater = new WSRestFunctionUpdater(repository);
                const newValues = { description: 'Updated endpoint description' };
                await wsRestFunctionUpdater.execute(wsRestFunction.id.value, newValues);
                const result = await repository.find(wsRestFunction.id);
                expect(result).toBeInstanceOf(WSRestFunction);
                expect(result.description.value).toBe(newValues.description);
            });
        });

        it('should throw an error when updating a non-existent WSRestFunction', async () => {
            const wsRestFunctionUpdater = new WSRestFunctionUpdater(repository);
            const newValues = { description: 'Updated description' };
            const nonExistentId = uuidv4();
            await expect(wsRestFunctionUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
                'RestFunction not found.',
                'id'
            );
        });
    });

    describe('Deletion', () => {
        it('should delete an existing WSRestFunction', async () => {
            await TenantContext.run(tenant, async () => {
                const wsRestFunction = await WSRestFunctionMother.create(repository);
                const wsRestFunctionDeleter = new WSRestFunctionDeleter(repository);

                const deleteInfo = {
                    deleted_at: new Date().toISOString(),
                    deleted_by: uuidv4(),
                };

                await wsRestFunctionDeleter.execute(wsRestFunction.id.value, deleteInfo);

                const result = await repository.find(wsRestFunction.id);
                expect(result).toBeInstanceOf(WSRestFunction);
                expect(result.deleted_at).not.toBeNull();
                expect(result.deleted_by).not.toBeNull();
            });
        });

        it('should throw an error when updating a non-existent WSRestFunction', async () => {
            const wsRestFunctionUpdater = new WSRestFunctionDeleter(repository);
            const newValues = { description: 'Updated description' };
            const nonExistentId = uuidv4();

            await expect(wsRestFunctionUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
                'RestFunction not found.'
            );
        });
    });

    describe('Search', () => {
        it('should search for WSRestFunctions based on given criteria', async () => {
            await TenantContext.run(tenant, async () => {
                for (let i = 0; i < 10; i++) {
                    await WSRestFunctionMother.create(repository);
                }
                const dtoCriteria = {
                    filter: undefined,
                    relationship: undefined,
                    limit: 10,
                    offset: 0,
                    order: { field: 'ws_rest_functions.created_at', direction: 'asc' },
                };
                const wsRestFunctionSearcher = new WSRestFunctionSearcher(repository);
                const searchResult = await wsRestFunctionSearcher.execute(dtoCriteria);
                expect(searchResult).toBeInstanceOf(WSRestFunctionCollectionResponse);
            });
        });

        it('should throw QueryDBError when repository.search fails internally', async () => {
            const repository = new KnexWSRestFunctionRepository(knexConfig);
            await expect(repository.search({})).rejects.toThrow(QueryDBError);
        });

        it('should throw QueryDBError when repository.find fails internally', async () => {
            const repository = new KnexWSRestFunctionRepository(knexConfig);
            await expect(repository.find({})).rejects.toThrow(QueryDBError);
        });
    });
});
