import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { Case } from '../../src/cases/index.js';
import { Criteria, EntityCache } from '../../src/shared';
import CasesMother from '../cases/domain/CasesMother.js';
import { knexConfig } from '../knexfile.js';

describe('KnexCaseRepository count cache', () => {
    const repository = new KnexCaseRepository(knexConfig);

    beforeEach(() => {
        EntityCache.clear();
    });

    it('count(criteria) returns the same cached object on consecutive calls', async () => {
        const filter = [{ field: 'ans_posicion', operator: 'eq', value: '1', type: 'AND' }];
        const criteria = new Criteria(filter, null, null, null, null, repository.tableName);

        const first = await repository.count(criteria);
        const second = await repository.count(criteria);

        expect(second).toBe(first);
    });

    it('count(criteria) returns a fresh object after the cases:count namespace is invalidated', async () => {
        const filter = [{ field: 'ans_posicion', operator: 'eq', value: '1', type: 'AND' }];
        const criteria = new Criteria(filter, null, null, null, null, repository.tableName);

        const first = await repository.count(criteria);
        EntityCache.invalidateNamespace('cases:count');
        const second = await repository.count(criteria);

        expect(second).not.toBe(first);
        expect(second).toEqual(first);
    });

    it('count(criteria) is invalidated when a case is saved', async () => {
        const filter = [{ field: 'ans_posicion', operator: 'eq', value: '1', type: 'AND' }];
        const criteria = new Criteria(filter, null, null, null, null, repository.tableName);

        const before = await repository.count(criteria);
        const beforeCount = Number(before.count);

        const dto = CasesMother.dto({ ans_posicion: 1 });
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await repository.save(Case.create(dto));

        const after = await repository.count(criteria);
        const afterCount = Number(after.count);

        expect(after).not.toBe(before);
        expect(afterCount).toBe(beforeCount + 1);
    });

    it('searchCount(criteria) returns the same cached object on consecutive calls', async () => {
        const filter = [{ field: 'ans_posicion', operator: 'eq', value: '1', type: 'AND' }];
        const criteria = new Criteria(filter, null, null, null, null, repository.tableName);

        const first = await repository.searchCount(criteria);
        const second = await repository.searchCount(criteria);

        expect(second).toBe(first);
    });

    it('searchCountByStatus(criteria) returns the same cached array on consecutive calls', async () => {
        const filter = [{ field: 'ans_posicion', operator: 'eq', value: '1', type: 'AND' }];
        const criteria = new Criteria(filter, null, null, null, null, repository.tableName);

        const first = await repository.searchCountByStatus(criteria);
        const second = await repository.searchCountByStatus(criteria);

        expect(second).toBe(first);
    });

    it('save() invalidates both cases:searchCount and cases:countByStatus namespaces', async () => {
        const filter = [{ field: 'ans_posicion', operator: 'eq', value: '1', type: 'AND' }];
        const criteria = new Criteria(filter, null, null, null, null, repository.tableName);

        const searchCountBefore = await repository.searchCount(criteria);
        const statusBefore = await repository.searchCountByStatus(criteria);
        const searchCountBeforeNumber = Number(searchCountBefore.count);
        const statusBeforeTotal = statusBefore.reduce((acc, row) => acc + row.count, 0);

        // searchCount/searchCountByStatus require INNER JOINs to clients, grupos, usuarios,
        // transiciones, clasificaciones — use createCaseWithRelations so the new row survives.
        await CasesMother.createCaseWithRelations(repository, { ans_posicion: 1 });

        const searchCountAfter = await repository.searchCount(criteria);
        const statusAfter = await repository.searchCountByStatus(criteria);
        const searchCountAfterNumber = Number(searchCountAfter.count);
        const statusAfterTotal = statusAfter.reduce((acc, row) => acc + row.count, 0);

        expect(searchCountAfter).not.toBe(searchCountBefore);
        expect(statusAfter).not.toBe(statusBefore);
        expect(searchCountAfterNumber).toBe(searchCountBeforeNumber + 1);
        expect(statusAfterTotal).toBe(statusBeforeTotal + 1);
    });
});
