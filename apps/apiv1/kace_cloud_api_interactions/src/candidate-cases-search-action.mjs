const CANDIDATE_CASE_SEARCH_RESOURCE = '/interaction-cases/candidates/search';
const CANDIDATE_CASE_SEARCH_ENDPOINT = 'interactions.candidate-cases.search';

export const isCandidateCaseSearch = (event) =>
    (event.originalResource ?? event.resource) === CANDIDATE_CASE_SEARCH_RESOURCE;

export async function executeCandidateCasesSearch({ query, authorize, search, isAuthorizationError }) {
    try {
        const authorizedQuery = authorize(CANDIDATE_CASE_SEARCH_ENDPOINT, query);
        return { kind: 'success', response: await search(authorizedQuery) };
    } catch (error) {
        if (isAuthorizationError(error)) {
            return { kind: 'forbidden', error };
        }
        throw error;
    }
}
