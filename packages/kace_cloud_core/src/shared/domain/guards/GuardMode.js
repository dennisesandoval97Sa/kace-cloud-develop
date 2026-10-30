export const GUARD_MODE = Object.freeze({
    ENFORCE: 'enforce',
    OBSERVE: 'observe',
});

/**
 * Resolves the active SQL guard mode from the environment.
 *
 * Defaults to ENFORCE (blocking, current behavior) and falls back to ENFORCE
 * for any unrecognized value (fail-safe).
 *
 * @returns {'enforce' | 'observe'}
 */
export function resolveGuardMode() {
    const raw = String(process.env.SQL_GUARD_MODE ?? '')
        .trim()
        .toLowerCase();

    return raw === GUARD_MODE.OBSERVE ? GUARD_MODE.OBSERVE : GUARD_MODE.ENFORCE;
}
