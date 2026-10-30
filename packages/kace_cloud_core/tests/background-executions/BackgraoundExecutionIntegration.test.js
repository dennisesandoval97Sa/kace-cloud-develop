import { knexConfig } from '../knexfile.js';
import { BackgroundExecutionCreator } from '../../src/background-executions/aplication/create/BackgroundExecutionCreator';
import { KnexBackgroundExecutionRepository } from '../../src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository';
import BackgroundExecutionMother from './domain/BackgroundExecutionMother.js';
import { BackgroundExecutionResponse } from '../../src/background-executions/aplication/BackgroundExecutionResponse.js';
import { BackgroundExecutionFinder } from '../../src/background-executions/aplication/find/BackgroundExecutionFinder.js';
import { BackgroundExecutionUpdater } from '../../src/background-executions/aplication/update/BackgroundExecutionUpdater.js';
import { CustomError, ValidationFailError } from '../../src/shared/index.js';
import { v4 as uuid } from 'uuid';
import { BackgroundExecutionCounter } from '../../src/background-executions/domain/BackgroundExecutionCounter.js';
import { BackgroundExecution } from '../../src/background-executions/domain/BackgroundExecution.js';
import { BackgroundExecutionDeleter } from '../../src/background-executions/aplication/delete/BackgroundExecutionDeleter.js';
import { BackgroundExecutionCollectionResponse } from '../../src/background-executions/aplication/BackgroundExecutionCollectionResponse.js';
import { BackgroundExecutionSearcher } from '../../src/background-executions/aplication/search/BackgroundExecutionSearcher.js';

describe('BackgroundExecution Integration Tests', () => {
    const repository = new KnexBackgroundExecutionRepository(knexConfig);

    it('should create a BackgroundExecution', async () => {
        const dto = BackgroundExecutionMother.dto();
        const backgroundExecutionCreator = new BackgroundExecutionCreator(repository);

        await backgroundExecutionCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });
    it('can get an existing BackgroundExecution', async () => {
        const backgroundExecution = await BackgroundExecutionMother.create(repository);
        const backgroundExecutionFinder = new BackgroundExecutionFinder(repository);

        const backgroundExecutionResult = await backgroundExecutionFinder.execute(backgroundExecution.id.value);

        expect(backgroundExecutionResult).not.toBeNull();
        expect(backgroundExecutionResult).toBeInstanceOf(BackgroundExecutionResponse);
    });
    it('can get an existing BackgroundExecution by proccess_description', async () => {
        const backgroundExecution = await BackgroundExecutionMother.create(repository);
        const backgroundExecutionFinder = new BackgroundExecutionFinder(repository);

        const backgroundExecutionResult = await backgroundExecutionFinder.findByProccess(
            backgroundExecution.proccess_description.value
        );

        expect(backgroundExecutionResult).not.toBeNull();
        expect(backgroundExecutionResult).toBeInstanceOf(BackgroundExecutionResponse);
    });
    it('can update an existing BackgroundExecution', async () => {
        const backgroundExecution = await BackgroundExecutionMother.create(repository);
        const backgroundExecutionUpdater = new BackgroundExecutionUpdater(repository);
        // `execution_status` es una columna booleana: postgres devuelve `true`, no
        // el `1` que devolvia sqlite. Lo que se escribe tiene que ser lo mismo que
        // se lee, asi que el booleano va en el propio `newValues`.
        const newValues = { execution_status: true };
        await backgroundExecutionUpdater.execute(backgroundExecution.id.value, newValues);

        const result = await repository.find(backgroundExecution.id);
        expect(result).toBeInstanceOf(BackgroundExecution);
        expect(result.execution_status.value).toBe(newValues.execution_status);
    });
    it('can delete an existing BackgroundExecution', async () => {
        const backgroundExecution = await BackgroundExecutionMother.create(repository);
        const backgroundExecutionDeleter = new BackgroundExecutionDeleter(repository);

        await backgroundExecutionDeleter.execute(backgroundExecution.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuid(),
        });

        const result = await repository.find(backgroundExecution.id);
        expect(result).toBeInstanceOf(BackgroundExecution);
        expect(result.deleted_at).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });
    it('searches for BackgroundExecution with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await BackgroundExecutionMother.create(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'updated_at', direction: 'asc' },
        };
        const backgroundExecutionSearcher = new BackgroundExecutionSearcher(repository);

        const searchResult = await backgroundExecutionSearcher.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(BackgroundExecutionCollectionResponse);
    });
    it('should throw an error when creating an existing BackgroundExecution', async () => {
        const backgroundExecution = await BackgroundExecutionMother.create(repository);
        const backgroundExecutionCreator = new BackgroundExecutionCreator(repository);

        const dto = { ...BackgroundExecutionMother.dto(), id: backgroundExecution.id.value };
        await expect(backgroundExecutionCreator.execute(dto)).rejects.toThrow(
            new CustomError(`BackgroundExecution with id ${dto.id} already exists`)
        );
    });
    it('should return null when trying to find a BackgroundExecution with a non-existent ID', async () => {
        const backgroundExecutionFinder = new BackgroundExecutionFinder(repository);

        await expect(backgroundExecutionFinder.execute(uuid())).rejects.toThrow(ValidationFailError);
    });
    it('should throw an error when creating a BackgroundExecution with invalid data', async () => {
        const dto = BackgroundExecutionMother.dto();
        delete dto.id;
        const backgroundExecutionCreator = new BackgroundExecutionCreator(repository);

        await expect(backgroundExecutionCreator.execute(dto)).rejects.toThrow();
    });
    it('should throw an error when trying to update a non-existent BackgroundExecution', async () => {
        const backgroundExecutionUpdater = new BackgroundExecutionUpdater(repository);
        const newValues = { execution_status: 1 };
        const nonExistentId = uuid();

        await expect(backgroundExecutionUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `backgroundExecution with id ${nonExistentId} does not exist.`
        );
    });
    it('should not throw an error when deleting a non-existent BackgroundExecution', async () => {
        const backgroundExecutionDeleter = new BackgroundExecutionDeleter(repository);
        const nonExistentId = uuid();
        await expect(
            backgroundExecutionDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuid(),
            })
        ).rejects.toThrow(`BackgroundExecution with id ${nonExistentId} does not exist.`);
    });
    it('should count BackgroundExecution instances correctly', async () => {
        await repository.connection('background_executions').del();
        for (let i = 0; i < 10; i++) {
            await BackgroundExecutionMother.create(repository);
        }
        const counter = new BackgroundExecutionCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });
});
