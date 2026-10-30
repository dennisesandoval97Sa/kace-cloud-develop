/**
 * Store paths and timing used by the bulk actions context resolver (DataTable).
 * @see useDataTableBulkActionsResolution.hook.js
 */

/** Dot-path: id del grupo seleccionado en sesión (Kace store). */
export const STORE_PATH_SELECTED_GROUP_ID = 'config.selected_group_id';

/** Dot-path: payload de usuario devuelto por auth-cognito (incluye user, groups). */
export const STORE_PATH_AUTH_USER_DATA = 'auth.user_data';

/** Dot-path: id de configuración del grupo activo (si aplica). */
export const STORE_PATH_CONFIGURATION_ID_SELECTED_GROUP =
  'configuration_id_selected_group';

/**
 * Intervalo (ms) para reevaluar el código de contexto cuando está definido,
 * de modo que un cambio de grupo en el mismo tab actualice la lista sin recargar.
 */
export const BULK_ACTIONS_CONTEXT_POLL_MS = 3000;
