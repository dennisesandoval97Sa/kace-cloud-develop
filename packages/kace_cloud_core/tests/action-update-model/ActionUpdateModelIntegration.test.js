import {
    ActionUpdateModel,
    ActionUpdateModelCollectionResponse,
    ActionUpdateModelCounter,
    ActionUpdateModelCreator,
    ActionUpdateModelDeleter,
    ActionUpdateModelFinder,
    ActionUpdateModelResponse,
    ActionUpdateModelSearcher,
    ActionUpdateModelUpdater,
    KnexActionUpdateModelRepository,
} from '../../src/action-update-model/index.js';
import ActionUpdateModelMother from './domain/ActionUpdateModelMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';

describe('ActionUpdateModel Integration Tests', () => {
    const repository = new KnexActionUpdateModelRepository(knexConfig);

    it('should create an ActionUpdateModel', async () => {
        const dto = ActionUpdateModelMother.dto();
        const actionUpdateModelCreator = new ActionUpdateModelCreator(repository);

        await actionUpdateModelCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing ActionUpdateModel', async () => {
        const actionUpdateModel = await ActionUpdateModelMother.create(repository);
        const actionUpdateModelFinder = new ActionUpdateModelFinder(repository);

        const result = await actionUpdateModelFinder.execute(actionUpdateModel.id.value);

        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(ActionUpdateModelResponse);
    });

    it('can update an existing ActionUpdateModel', async () => {
        const actionUpdateModel = await ActionUpdateModelMother.create(repository);
        const actionUpdateModelUpdater = new ActionUpdateModelUpdater(repository);

        const newValues = { description: 'Updated action update model description' };
        await actionUpdateModelUpdater.execute(actionUpdateModel.id.value, newValues);

        const result = await repository.find(actionUpdateModel.id);
        expect(result).toBeInstanceOf(ActionUpdateModel);
        expect(result.description.value).toBe(newValues.description);
    });

    it('can delete an existing ActionUpdateModel', async () => {
        const actionUpdateModel = await ActionUpdateModelMother.create(repository);
        const actionUpdateModelDeleter = new ActionUpdateModelDeleter(repository);

        await actionUpdateModelDeleter.execute(actionUpdateModel.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuid(),
        });

        const result = await repository.find(actionUpdateModel.id);
        expect(result).toBeInstanceOf(ActionUpdateModel);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for ActionUpdateModels with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await ActionUpdateModelMother.create(repository);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const actionUpdateModelSearcher = new ActionUpdateModelSearcher(repository);

        const searchResult = await actionUpdateModelSearcher.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(ActionUpdateModelCollectionResponse);
    });

    it('should throw an error when creating an existing ActionUpdateModel', async () => {
        const actionUpdateModel = await ActionUpdateModelMother.create(repository);
        const actionUpdateModelCreator = new ActionUpdateModelCreator(repository);

        const dto = { ...ActionUpdateModelMother.dto(), id: actionUpdateModel.id.value };
        await expect(actionUpdateModelCreator.execute(dto)).rejects.toThrow(
            new CustomError(`ActionUpdateModel with id ${dto.id} already exists`)
        );
    });

    it('throws an error if actionUpdateModel not found', async () => {
        const actionUpdateModelFinder = new ActionUpdateModelFinder(repository);

        await expect(actionUpdateModelFinder.execute(uuid())).rejects.toThrow('Action update model not found');
    });

    it('should throw an error when creating an ActionUpdateModel with invalid data', async () => {
        const dto = ActionUpdateModelMother.dto();
        delete dto.id;
        const actionUpdateModelCreator = new ActionUpdateModelCreator(repository);

        await expect(actionUpdateModelCreator.execute(dto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent ActionUpdateModel', async () => {
        const actionUpdateModelUpdater = new ActionUpdateModelUpdater(repository);
        const newValues = { description: 'Updated description' };
        const nonExistentId = uuid();

        await expect(actionUpdateModelUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `ActionUpdateModel with ID ${nonExistentId} does not exist.`
        );
    });

    it('should not throw an error when deleting a non-existent ActionUpdateModel', async () => {
        const actionUpdateModelDeleter = new ActionUpdateModelDeleter(repository);
        const nonExistentId = uuid();
        await expect(
            actionUpdateModelDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuid(),
            })
        ).rejects.toThrow(`ActionUpdateModel with ID ${nonExistentId} does not exist.`);
    });

    it('should count ActionUpdateModel instances correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await ActionUpdateModelMother.create(repository);
        }

        const counter = new ActionUpdateModelCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });
});
