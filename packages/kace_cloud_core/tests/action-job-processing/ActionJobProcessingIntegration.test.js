import {
    ActionJobProcessingCreator,
    ActionJobProcessingFinder,
    ActionJobProcessingUpdater,
    ActionJobProcessingDeleter,
    ActionJobProcessingSearcher,
    ActionJobProcessingCounter,
    KnexActionJobProcessingRepository,
    ActionJobProcessingResponse,
    ActionJobProcessing,
    ActionJobProcessingCollectionResponse,
    DomainActionJobProcessingFinder,
} from '../../src/action-job-processing/index.js';
import ActionJobProcessingMother from './domain/ActionJobProcessingMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';

describe('ActionJobProcessing Integration Tests', () => {
    const repository = new KnexActionJobProcessingRepository(knexConfig);

    it('should create an ActionJobProcessing', async () => {
        const dto = ActionJobProcessingMother.dto();
        await ActionJobProcessingMother.ensureRelations(repository.connection, dto);
        const actionExecutionCreator = new ActionJobProcessingCreator(repository);

        await actionExecutionCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing ActionJobProcessing', async () => {
        const actionExecution = await ActionJobProcessingMother.create(repository);
        const actionExecutionFinder = new ActionJobProcessingFinder(repository);

        const result = await actionExecutionFinder.execute(actionExecution.id.value);

        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(ActionJobProcessingResponse);
    });

    it('can update an existing ActionJobProcessing', async () => {
        const actionExecution = await ActionJobProcessingMother.create(repository);
        const actionExecutionUpdater = new ActionJobProcessingUpdater(repository);

        const newValues = { case_id: uuid(), details: { message: 'Updated action execution' } };
        await ActionJobProcessingMother.ensureRelations(repository.connection, newValues);
        await actionExecutionUpdater.execute(actionExecution.id.value, newValues);

        const result = await repository.find(actionExecution.id);

        expect(result).toBeInstanceOf(ActionJobProcessing);
        expect(result.case_id.value).toBe(newValues.case_id);
        expect(result.details.value).toEqual(newValues.details);
    });

    it('can delete an existing ActionJobProcessing', async () => {
        const actionExecution = await ActionJobProcessingMother.create(repository);
        const actionExecutionDeleter = new ActionJobProcessingDeleter(repository);

        await actionExecutionDeleter.execute(actionExecution.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuid(),
        });

        const result = await repository.find(actionExecution.id);
        expect(result).toBeInstanceOf(ActionJobProcessing);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for ActionJobProcessings with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await ActionJobProcessingMother.create(repository);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const actionExecutionSearcher = new ActionJobProcessingSearcher(repository);

        const searchResult = await actionExecutionSearcher.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(ActionJobProcessingCollectionResponse);
    });

    it('should throw an error when creating an existing ActionJobProcessing', async () => {
        const actionExecution = await ActionJobProcessingMother.create(repository);
        const actionExecutionCreator = new ActionJobProcessingCreator(repository);

        const dto = { ...ActionJobProcessingMother.dto(), id: actionExecution.id.value };
        await expect(actionExecutionCreator.execute(dto)).rejects.toThrow(
            new CustomError(`ActionJobProcessing with id ${dto.id} already exists`)
        );
    });

    it('should return null when trying to Domainfind an ActionJobProcessing with a non-existent ID', async () => {
        const domainActionJobProcessingFinder = new DomainActionJobProcessingFinder(repository);

        const actionExecutionResult = await domainActionJobProcessingFinder.execute(uuid());

        expect(actionExecutionResult).toEqual(null);
    });

    it('should throw an error when trying to find an ActionJobProcessing with a non-existent ID', async () => {
        const actionExecutionFinder = new ActionJobProcessingFinder(repository);

        await expect(actionExecutionFinder.execute(uuid())).rejects.toThrow('Action execution not found');
    });

    it('should throw an error when creating an ActionJobProcessing with invalid data', async () => {
        const dto = ActionJobProcessingMother.dto();
        await ActionJobProcessingMother.ensureRelations(repository.connection, dto);
        delete dto.id;
        const actionExecutionCreator = new ActionJobProcessingCreator(repository);

        await expect(actionExecutionCreator.execute(dto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent ActionJobProcessing', async () => {
        const actionExecutionUpdater = new ActionJobProcessingUpdater(repository);
        const newValues = { is_in_progress: false };
        const nonExistentId = uuid();

        await expect(actionExecutionUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `ActionJobProcessing with ID ${nonExistentId} does not exist.`
        );
    });

    it('should not throw an error when deleting a non-existent ActionJobProcessing', async () => {
        const actionExecutionDeleter = new ActionJobProcessingDeleter(repository);
        const nonExistentId = uuid();
        await expect(
            actionExecutionDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuid(),
            })
        ).rejects.toThrow(`ActionJobProcessing with ID ${nonExistentId} does not exist.`);
    });

    it('should count ActionJobProcessing instances correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await ActionJobProcessingMother.create(repository);
        }

        const counter = new ActionJobProcessingCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });
});
