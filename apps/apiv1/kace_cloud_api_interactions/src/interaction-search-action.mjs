const AGENT_SEARCH_RESOURCE = '/agent/search';

export async function executeInteractionSearch({
    event,
    user,
    query,
    authorize,
    repository,
    createSearcher,
    activeGroupScopeFromUser,
}) {
    const authorizedQuery = authorize('interactions.search', query);
    const searcher = createSearcher(repository);
    const resource = event.originalResource ?? event.resource;

    if (resource === AGENT_SEARCH_RESOURCE) {
        return searcher.execute(authorizedQuery, activeGroupScopeFromUser(user));
    }

    return searcher.executeForAdminSearch(authorizedQuery);
}
