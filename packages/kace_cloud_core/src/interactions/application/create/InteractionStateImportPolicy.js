function hasPermission(user, permission) {
    return user?.hasPermission?.('administrador', 'interactions', permission) === true;
}

/**
 * @param {object} interaction interaction creation payload
 * @returns {string|null} validation failure reason, or null when the imported state is coherent
 */
export function importedInteractionStateValidationError(interaction) {
    const isClosed = interaction?.is_closed === true;
    const isInReview = interaction?.in_review === true;

    if ((isClosed || isInReview) && interaction?.is_migrated !== true) {
        return 'can only set is_closed or in_review when is_migrated is true';
    }
    if (isClosed && isInReview) {
        return 'cannot be closed and in review at the same time';
    }
    if (isClosed && (!interaction.closed_at || !interaction.closed_by)) {
        return 'requires closed_at and closed_by when is_closed is true';
    }
    if (isInReview && (!interaction.start_review_at || !interaction.start_review_by)) {
        return 'requires start_review_at and start_review_by when in_review is true';
    }

    return null;
}

/**
 * Imported state is client-supplied data, so `is_migrated` is not an authorization boundary by itself.
 * Reuse the permissions of the canonical state-changing flows before allowing create endpoints to
 * persist a historical closed or review state.
 *
 * @param {object} user authenticated user
 * @param {object|object[]} payload interaction payload or batch
 * @returns {boolean}
 */
export function canImportInteractionState(user, payload) {
    const interactions = Array.isArray(payload) ? payload : [payload];
    const importsClosedState = interactions.some((interaction) => interaction?.is_closed === true);
    const importsReviewState = interactions.some((interaction) => interaction?.in_review === true);
    const importsStateWithoutMigrationMarker = interactions.some(
        (interaction) =>
            (interaction?.is_closed === true || interaction?.in_review === true) && interaction?.is_migrated !== true
    );

    if (importsStateWithoutMigrationMarker) return false;
    if (importsClosedState && !hasPermission(user, 'InteractionsBulkClose')) return false;
    if (importsReviewState && !hasPermission(user, 'InteractionsUpdate')) return false;

    return true;
}
