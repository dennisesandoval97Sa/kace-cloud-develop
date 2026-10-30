const BOARDS_ROOT_KEY = "boards";

export const QUERY_KEYS = {
    ACTIONS: {
        ROOT: ["actions"],
    },
    ACTION_JOBS: {
        MUTATE: ["action-jobs", "mutate"],
    },
    ANS: {
        ROOT: ["ans"],
    },
    BOARDS: {
        ROOT_KEY: BOARDS_ROOT_KEY,
        ROOT: [BOARDS_ROOT_KEY],
        ENTITY: (entity) => ["boards", "entity", entity],
        ENTITIES: ["boards", "entities"],
        DETAILS: (id) => ["boards", "details", id],
        AVAILABLE: ["boards", "available"],
        MUTATE: ["boards", "mutate"],
        RESOURCES: (id, page, criteria = null, activeClientId = null) => {
            const basic_keys = ["boards", "resources", id, page];
            if (criteria) basic_keys.push(criteria);
            if (typeof activeClientId === "string" && activeClientId.length > 0) {
                basic_keys.push(activeClientId);
            }
            return basic_keys;
        },
    },
    GROUPS: {
        ROOT: ["groups"],
    },
    ONE_SCRIPT: {
        ROOT: ["one-script"],
        DETAILS: (id) => ["one-script", "details", id],
    },
    REST_FLOWS: {
        ROOT: ["rest-flows"],
    },
    USERS: {
        ROOT: ["users"],
        BY_IDS: (ids) => ["users", "by-ids", ids],
    },
    SCHEMAS: {
        ROOT: ["schemas"],
    },
};
