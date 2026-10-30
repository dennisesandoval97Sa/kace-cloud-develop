import { v4 as uuidv4 } from 'uuid';
import { KnexUsersRepository } from '../../../../src/users/infrastructure/KnexUsersRepository.js';
import { UserSearcher } from '../../../../src/users/application/search/UserSearcher.js';
import { UserCollectionResponse } from '../../../../src/users/application/UserCollectionResponse.js';
import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { knexConfig } from '../../../knexfile.js';

describe('UserSearcher: no results (short-circuits #addGroupsData and #addCasesCounter)', () => {
    const repository = new KnexUsersRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(repository.connection);

    it('returns an empty collection without enriching groups/case-counts when nothing matches', async () => {
        const userSearcher = new UserSearcher(repository, caseRepository);
        const dtoCriteria = {
            filter: [{ field: 'login', operator: 'eq', value: `no-such-login-${uuidv4()}`, type: 'AND' }],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const result = await userSearcher.execute(dtoCriteria);

        expect(result).toBeInstanceOf(UserCollectionResponse);
        const json = result.toJson();
        expect(json.data.items).toEqual([]);
        expect(json.metadata.count).toBe('0');
    });
});
