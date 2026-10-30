export const CASES_SERVICE = "/cases";
export const CLASSIFICATIONS_SERVICE = "/classifications";
export const STATES_SERVICE = "/states";
export const REOPEN_CASE = "/cases";
export const AUX_CASES_SERVICE = "/aux-cases";
export const TEMPLATES_SERVICE = "/templates";
export const USER_SERVICE = "/users";
export const CLASSIFICATION_GROUP_RELATIONSHIPS_SERVICE = "/classifications-groups-relationships";
export const MAIL_ACCOUNT_TYPE_SERVICE = "/mail-accounts-types";
export const CLASSIFICATION_LEVELS_SERVICE = "/classifications-levels";
export const RELATIONSHIPS_SERVICE = "classifications-groups-relationships";
export const TRANSITIONS_SERVICE = "/transitions";
export const COUNT_CASES_SERVICE = "/cases-count";
export const ALL_STATES_SERVICE = "/states-distinct";
export const GENERAL_SETUP_SERVICE = "/global-configuration";
export const AUX_CLIENT_SERVICE = "/aux-clients";
export const ACTIONS_SERVICE = "/actions";
export const TRANSITION_RULES_SERVICE = "/transition-rules";
export const FOLIO_CONFIGURATIONS_SERVICE = "/folio-configurations";
export const WS_FLOWS_SERVICE = "/ws-rest-flows";

export const API = {
    BASE_URL: import.meta.env.VITE_DEV_BASE_API_URL,
};

export const PAGINATION_TYPES = {
    pager: "PAGER",
    infinite: "INFINITE",
};

export const TYPE_DOCUMENT = Object.freeze({
    NIT: "NIT",
    CC: "CC",
});

export const TYPE_CUSTOMER = Object.freeze({
    COMMERCIAL: "Comercial",
    NATURAL: "Natural",
});
