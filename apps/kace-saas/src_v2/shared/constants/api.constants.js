export const API = {
    ENDPOINTS: {
        ACTIONS: { SEARCH: `/actions/search` },
        ACTION_JOBS: { ROOT: `/action-jobs` },
        ANS: { ROOT: `/ans` },
        BOARDS: {
            ROOT: "/boards",
            DETAILS: (id) => `/boards/${id}`,
            ENTITIES: "/boards/relations",
            AVAILABLE: "/boards/available",
            RESOURCES: (id, page = 1, { activeClientId, export: isExport } = {}) => {
                const params = new URLSearchParams({ page: String(page) });
                if (isExport) params.set("export", "true");
                if (activeClientId) params.set("active_client", activeClientId);
                return `/boards/${id}/resources?${params}`;
            },
        },
        GROUPS: { SEARCH: `/groups/search` },
        USERS: { SEARCH: `/users/search` },
        ONE_SCRIPT: { SEARCH: `/one_script/search`, DETAILS: (id) => `/one_script/${id}` },
        REST_FLOWS: { ROOT: "/ws-rest-flows", SEARCH: `/ws-rest-flows/search` },
        SCHEMAS: { SEARCH: `/schemas/search`, RULES: (id) => `/schemas/${id}/rules` },
        CASES_BULK: {
            ASSIGN: `/cases-bulk/assign`,
            TRANSITION: `/cases-bulk/transition`,
            CLOSE: `/cases-bulk/close`,
        },
        INTERACTIONS_BULK: {
            MOVE: `/interactions-bulk/move`,
            CLOSE: `/interactions-bulk/close`,
            DELETE: `/interactions-bulk/delete`,
            AGENT_MOVE: `/interactions-bulk/agent/move`,
            AGENT_CLOSE: `/interactions-bulk/agent/close`,
            AGENT_MOVE_DESTINATIONS: (interactionId) => `/interactions-bulk/agent/${interactionId}/move-destinations`,
        },
        AUX_BULK: {
            DELETE: (entity) => `/auxiliaries/${entity}/bulk-delete`,
        },
    },
};
