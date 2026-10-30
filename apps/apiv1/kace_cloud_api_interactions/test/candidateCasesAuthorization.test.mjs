import { jest } from '@jest/globals';
import { executeCandidateCasesSearch, isCandidateCaseSearch } from '../src/candidate-cases-search-action.mjs';

class SearchAuthorizationError extends Error {}

const query = {
    filter: [{ field: 'cliente_id', operator: 'eq', value: '7', type: 'AND' }],
    relationship: null,
    limit: 10,
    offset: 0,
};
const authorize = jest.fn((_endpointKey, value) => value);
const search = jest.fn();
const isAuthorizationError = (error) => error instanceof SearchAuthorizationError;

describe('candidate cases search action', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        authorize.mockImplementation((_endpointKey, value) => value);
        search.mockResolvedValue({ toJson: () => ({ data: { items: [] } }) });
    });

    it('recognizes only the candidate-cases resource', () => {
        expect(
            isCandidateCaseSearch({
                resource: '/search',
                originalResource: '/interaction-cases/candidates/search',
            })
        ).toBe(true);
        expect(isCandidateCaseSearch({ resource: '/interaction-cases' })).toBe(false);
    });

    it('authorizes candidate search against interactions.candidate-cases.search', async () => {
        const result = await executeCandidateCasesSearch({
            query,
            authorize,
            search,
            isAuthorizationError,
        });

        expect(result.kind).toBe('success');
        expect(authorize).toHaveBeenCalledWith('interactions.candidate-cases.search', query);
        expect(search).toHaveBeenCalledWith(query);
    });

    it('returns a forbidden result without searching when authorization denies the query', async () => {
        authorize.mockImplementationOnce(() => {
            throw new SearchAuthorizationError('Search authorization denied');
        });

        const result = await executeCandidateCasesSearch({
            query,
            authorize,
            search,
            isAuthorizationError,
        });

        expect(result).toEqual({
            kind: 'forbidden',
            error: expect.any(SearchAuthorizationError),
        });
        expect(search).not.toHaveBeenCalled();
    });
});
