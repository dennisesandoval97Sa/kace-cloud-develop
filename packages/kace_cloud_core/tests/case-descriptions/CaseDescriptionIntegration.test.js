import {
    CaseDescription,
    CaseDescriptionCollectionResponse,
    CaseDescriptionCounter,
    CaseDescriptionCreator,
    CaseDescriptionFinder,
    CaseDescriptionResponse,
    CaseDescriptionSearcher,
    CaseDescriptionUpdater,
    KnexCaseDescriptionRepository,
} from '../../src/case-descriptions/index.js';
import CaseDescriptionsMother from './domain/CaseDescriptionsMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import UsersMother from '../users/domain/UsersMother.js';
import { User } from '../../src/users/index.js';

describe('CaseDescription Integration Tests', () => {
    const repository = new KnexCaseDescriptionRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(repository.connection);
    const currentUser = new User(UsersMother.dto());

    it('should create a CaseDescription', async () => {
        const dto = CaseDescriptionsMother.dto();
        const caseDescriptionCreator = new CaseDescriptionCreator(repository);

        await caseDescriptionCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing CaseDescription', async () => {
        const caseDescription = await CaseDescriptionsMother.createCaseDescription(repository);
        const caseDescriptionFinder = new CaseDescriptionFinder(repository);

        const caseDescriptionResult = await caseDescriptionFinder.execute(caseDescription.id.value);

        expect(caseDescriptionResult).not.toBeNull();
        expect(caseDescriptionResult).toBeInstanceOf(CaseDescriptionResponse);
    });

    it('can update an existing CaseDescription', async () => {
        const caseDescription = await CaseDescriptionsMother.createCaseDescription(repository);
        const caseDescriptionUpdater = new CaseDescriptionUpdater(repository, caseRepository, currentUser);

        const newValues = {
            descripcion: 'Description updated',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        await caseDescriptionUpdater.execute(caseDescription.id.value, newValues);

        const result = await repository.find(caseDescription.id);
        expect(result).toBeInstanceOf(CaseDescription);
        expect(result.descripcion.value).toBe(newValues.descripcion);
    });

    it('searches for CaseDescription instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await CaseDescriptionsMother.createCaseDescription(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'descripcion',
                    operator: 'notNull',
                    value: 'notNull',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const caseDescriptionSearch = new CaseDescriptionSearcher(repository);

        const caseDescriptionResult = await caseDescriptionSearch.execute(dtoCriteria);
        expect(caseDescriptionResult).toBeInstanceOf(CaseDescriptionCollectionResponse);
    });

    it('searches for CaseDescriptions with criteria that match no records', async () => {
        const dtoCriteria = {
            filter: [
                {
                    field: 'descripcion',
                    operator: 'eq',
                    value: '999',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const caseDescriptionSearch = new CaseDescriptionSearcher(repository);

        const caseDescriptionResult = await caseDescriptionSearch.execute(dtoCriteria);
        expect(caseDescriptionResult).toBeInstanceOf(CaseDescriptionCollectionResponse);
        expect(caseDescriptionResult.toJson().data.items.length).toBe(0);
    });

    it('should throw an error when creating an existing Case description', async () => {
        const caseDescription = await CaseDescriptionsMother.createCaseDescription(repository);
        const caseDescriptionCreator = new CaseDescriptionCreator(repository);

        const dto = { ...CaseDescriptionsMother.dto(), id: caseDescription.id.value };
        await expect(caseDescriptionCreator.execute(dto)).rejects.toThrow(
            new CustomError(`Case description with id ${dto.id} already exists`)
        );
    });

    it('should  throw an error when trying to find a CaseDescription with a non-existent ID', async () => {
        const caseDescriptionFinder = new CaseDescriptionFinder(repository);
        const nonExistentId = uuidv4();
        await expect(caseDescriptionFinder.execute(nonExistentId)).rejects.toThrow(
            `Case description with ID ${nonExistentId} does not exist.`
        );
    });

    it('should throw an error when creating a CaseDescription with invalid data', async () => {
        const invalidDto = CaseDescriptionsMother.dto();
        delete invalidDto.id;
        const caseDescriptionCreator = new CaseDescriptionCreator(repository);

        await expect(caseDescriptionCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent CaseDescription', async () => {
        const caseDescriptionUpdater = new CaseDescriptionUpdater(repository);
        const nonExistentId = uuidv4();
        const newValues = { descripcion: 'updated descripcion' };

        await expect(caseDescriptionUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `Case description with ID ${nonExistentId} does not exist.`
        );
    });

    it('should handle creating multiple CaseDescriptions with the same ID', async () => {
        const dto = CaseDescriptionsMother.dto();
        const caseDescriptionCreator = new CaseDescriptionCreator(repository);

        await caseDescriptionCreator.execute(dto);

        await expect(caseDescriptionCreator.execute(dto)).rejects.toThrow();
    });

    it('should count CaseDescriptions correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await CaseDescriptionsMother.createCaseDescription(repository);
        }
        const counter = new CaseDescriptionCounter(repository);

        const count = await counter.execute({ filter: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });
});
