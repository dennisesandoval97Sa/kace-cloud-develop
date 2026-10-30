/**
 * Single source of truth for how a KACE user is presented and searched by full name
 * (nombres + apellido1 + apellido2). Prefer these helpers over re-implementing the
 * "join the name parts" / "search each name column" pattern inline.
 *
 * `formatActiveGroupUserName` (pages/Group/utils/activeGroupUsersDisplay.js) is the same
 * function; that module should be migrated to re-export from here in a follow-up.
 */

/** Backend columns that hold the parts of a user's full name. */
export const USER_NAME_SEARCH_FIELDS = Object.freeze(["nombres", "apellido1", "apellido2"]);

/**
 * Mandatory base filter enforced by the `users.search` search-authorization policy.
 * Kept here so the UI does not hardcode the backend column name in more than one place.
 */
export const USERS_SEARCH_BASE_FILTER = Object.freeze([
    Object.freeze({ field: "usuarios.deleted_at", operator: "null", value: "null", type: "AND" }),
]);

/**
 * Builds the human readable full name of a user, skipping missing/blank parts so the
 * result never contains leading, trailing or doubled spaces.
 *
 * @param {{ nombres?: string, apellido1?: string, apellido2?: string } | null | undefined} user
 * @returns {string}
 */
export const formatUserFullName = ({ nombres, apellido1, apellido2 } = {}) =>
    [nombres, apellido1, apellido2].filter((part) => Boolean(part && String(part).trim())).join(" ");
