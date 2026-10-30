/*
 * rol_id and grupo_activo carry a foreign key: checking them first answers 404 instead of the 500 the
 * constraint raises. Every users write path that accepts them takes its rules from here.
 *
 * Membership of grupo_activo is not checked: the admin UI saves the user before syncing its groups, so
 * adding a group and activating it in the same save would be rejected. POST /update-active-group, the
 * self-service switch, adds that check on top.
 */
export const USER_RELATIONSHIP_RULES = Object.freeze([
    Object.freeze({ field: 'rol_id', table: 'roles' }),
    Object.freeze({ field: 'grupo_activo', table: 'grupos' }),
]);

/**
 * Rules for an update: only a value that differs from the stored one is checked, so re-sending a role or
 * group soft-deleted after the user got it keeps the edit working.
 *
 * @param {Object} payload - Validated update payload.
 * @param {Object} stored - Current values of the user.
 * @returns {Object[]}
 */
export const changedRelationshipRules = (payload, stored) =>
    USER_RELATIONSHIP_RULES.filter(({ field }) => payload[field] !== undefined && payload[field] !== stored[field]);
