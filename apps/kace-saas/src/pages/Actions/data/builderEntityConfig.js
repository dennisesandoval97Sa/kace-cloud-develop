import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { USER_NAME_SEARCH_FIELDS, USERS_SEARCH_BASE_FILTER, formatUserFullName } from "@/utils/userDisplay";

/**
 * Single source of truth for the entity-picker configurations used by the rule
 * builder (Actions feature). The shape of each entry is fixed at module load —
 * adding a new field to one kind without updating the other two is a type
 * error, not a runtime surprise.
 *
 * Three kinds are recognised:
 *
 *  - `users`         : full-name multi-field OR search, mandatory base filter
 *                      for the `users.search` search-authorization policy.
 *  - `states`        : single-field name search, no extra filter.
 *  - `classifications`: single-field description search, no extra filter.
 *
 * @typedef {Object} UsersBuilderConfig
 * @property {"users"} kind
 * @property {string} url
 * @property {string[]} keyQuery
 * @property {string} valueField
 * @property {string} labelField
 * @property {string[]} searchFields
 * @property {Array<{field:string,operator:string,value:string,type:string}>} baseFilter
 * @property {string} searchPlaceholder
 * @property {(item:object) => string} formatLabel
 *
 * @typedef {Object} SimpleBuilderConfig
 * @property {"states" | "classifications"} kind
 * @property {string} url
 * @property {string[]} keyQuery
 * @property {string} valueField
 * @property {string} labelField
 *
 * @typedef {UsersBuilderConfig | SimpleBuilderConfig} BuilderEntityConfig
 */

const usersConfig = Object.freeze({
    kind: "users",
    url: URL_AND_KEYS.users.url,
    keyQuery: Object.freeze(["builder_users"]),
    valueField: "id",
    labelField: "nombres",
    searchFields: USER_NAME_SEARCH_FIELDS,
    baseFilter: USERS_SEARCH_BASE_FILTER,
    searchPlaceholder: "actions.querybuilder.responsablePlaceholder",
    formatLabel: formatUserFullName,
});

const statesConfig = Object.freeze({
    kind: "states",
    url: URL_AND_KEYS.states.url,
    keyQuery: Object.freeze(["builder_states"]),
    valueField: "id",
    labelField: "nombre",
});

const classificationsConfig = Object.freeze({
    kind: "classifications",
    url: URL_AND_KEYS.classification.url,
    keyQuery: Object.freeze(["builder_classifications"]),
    valueField: "id",
    labelField: "description",
});

/**
 * Resolves the builder configuration for a given rule field, or `null` when the
 * field does not have a builder Select.
 *
 * @param {string | undefined | null} field
 * @returns {BuilderEntityConfig | null}
 */
export const resolveBuilderEntityConfig = (field) => {
    switch (field) {
        case "cases.responsable_id":
            return usersConfig;
        case "cases.estadoActual":
            return statesConfig;
        case "clasificaciones.description":
            return classificationsConfig;
        default:
            return null;
    }
};
