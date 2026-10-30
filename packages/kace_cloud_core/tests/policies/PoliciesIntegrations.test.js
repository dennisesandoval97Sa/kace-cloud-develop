import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CustomError } from '../../src/shared/errors/CustomError';
import { KnexPoliciesRepository } from '../../src/policies/infrastructure/persistence/KnexPoliciesRepository';
import { PoliciesMother } from './domain/PoliciesMother';
import { PoliciesCreator } from '../../src/policies/application/create/PoliciesCreator';
import { PolicyResponse } from '../../src/policies/application/PolicyResponse';
import { PoliciesFinder } from '../../src/policies/application/find/PoliciesFinder';
import { PoliciesUpdater } from '../../src/policies/application/update/PoliciesUpdater';
import { Policy } from '../../src/policies/domain/Policy';
import { PoliciesDeleter } from '../../src/policies/application/delete/PoliciesDeleter';
import { PoliciesSearcher } from '../../src/policies/application/search/PoliciesSearcher';
import { PolicyCollectionResponse } from '../../src/policies/application/PolicyCollectionResponse';
import { PoliciesCounter } from '../../src/policies/domain/PoliciesCounter';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';

describe('Policies integration tests', () => {
    const repository = new KnexPoliciesRepository(knexConfig);

    test('should create a policy instance', async () => {
        const dto = PoliciesMother.dto();
        const policyCreator = new PoliciesCreator(repository);

        await policyCreator.execute(dto);

        const result = await repository.connection('policies').where({ id: dto.id });

        expect(result.length).toBe(1);
    });

    test('finds an existing Policy instance by id', async () => {
        const policy = await PoliciesMother.createPolicy(repository);
        const policyFinder = new PoliciesFinder(repository);

        const policyResult = await policyFinder.execute(policy.id.value);

        expect(policyResult).not.toBeNull();
        expect(policyResult).toBeInstanceOf(PolicyResponse);
    });

    test('should return an error if not found a record', async () => {
        const policyFinder = new PoliciesFinder(repository);

        await expect(policyFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('should update an exist Policy instance', async () => {
        const policy = await PoliciesMother.createPolicy(repository);
        const policyUpdater = new PoliciesUpdater(repository);

        const dtoUpdate = {
            title: 'Title updated',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        await policyUpdater.execute(dtoUpdate, policy.id.value);

        const result = await repository.find(policy.id);
        expect(result).toBeInstanceOf(Policy);
        expect(result.title.value).toBe(dtoUpdate.title);
    });

    it('should return an error when update a non-existent Policy instance', async () => {
        await PoliciesMother.createPolicy(repository);
        const policyUpdater = new PoliciesUpdater(repository);

        await expect(policyUpdater.execute({ title: 'test' }, uuidv4())).rejects.toThrow(CustomError);
    });

    it('deletes an existing Policy instance by id', async () => {
        const policy = await PoliciesMother.createPolicy(repository);
        const policyDeleter = new PoliciesDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await policyDeleter.execute(deleteDto, policy.id.value);

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'deleted_at', direction: 'asc' },
        };

        const policySearcher = new PoliciesSearcher(repository);

        const policyResult = (await policySearcher.execute(dtoCriteria)).toJson();

        expect(policyResult.data.items[0].deleted_at).toBe(deleteDto.deleted_at);
        expect(policyResult.data.items[0].deleted_by).toBe(deleteDto.deleted_by);
    });

    it('should return an error when delete a non-existent Policy instance', async () => {
        await PoliciesMother.createPolicy(repository);
        const policyDeleter = new PoliciesDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await expect(policyDeleter.execute(deleteDto, uuidv4())).rejects.toThrow(CustomError);
    });

    it('searches for Policy instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await PoliciesMother.createRandomPolicy(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const policySearcher = new PoliciesSearcher(repository);

        const policyResult = await policySearcher.execute(dtoCriteria);

        expect(policyResult).toBeInstanceOf(PolicyCollectionResponse);
    });

    it('should return an error when not exist field is filtered', async () => {
        for (let i = 0; i < 10; i++) {
            await PoliciesMother.createRandomPolicy(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'not_exist',
                    operator: 'eq',
                    value: 'value',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        await expect(new PoliciesSearcher(repository).execute(dtoCriteria)).rejects.toThrow(QueryDBError);
    });

    it('counts the total number of Policies instances', async () => {
        for (let i = 0; i < 10; i++) {
            await PoliciesMother.createRandomPolicy(repository);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const policyCounter = new PoliciesCounter(repository);

        const policyResponse = await policyCounter.execute(dtoCriteria);

        expect(Number(policyResponse.count)).toBe(10);
    });

    it('should return a zero for not found criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await PoliciesMother.createRandomPolicy(repository);
        }

        const dtoCriteria = {
            filter: [
                {
                    field: 'title',
                    operator: 'eq',
                    value: '10',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const policiesCounter = new PoliciesCounter(repository);

        const policyResult = await policiesCounter.execute(dtoCriteria);

        expect(Number(policyResult.count)).toBe(0);
    });
});
