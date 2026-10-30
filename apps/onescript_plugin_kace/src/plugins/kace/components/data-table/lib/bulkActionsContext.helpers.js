import {
  STORE_PATH_AUTH_USER_DATA,
  STORE_PATH_CONFIGURATION_ID_SELECTED_GROUP,
  STORE_PATH_SELECTED_GROUP_ID,
} from './bulk-actions-context.constants.js';

/**
 * @param {unknown} result
 * @param {unknown[]} baseBulkActions
 * @returns {{ bulkActions: unknown[], disableBulkActions: boolean }}
 */
export function normalizeBulkActionsResolverResult(result, baseBulkActions) {
  const safeBase = Array.isArray(baseBulkActions) ? baseBulkActions : [];
  try {
    if (result == null) {
      return { bulkActions: safeBase, disableBulkActions: false };
    }
    if (Array.isArray(result)) {
      return { bulkActions: result, disableBulkActions: false };
    }
    if (typeof result === 'object') {
      const disableBulkActions = result.disableBulkActions === true;
      if (Array.isArray(result.bulkActions)) {
        return { bulkActions: result.bulkActions, disableBulkActions };
      }
      return { bulkActions: safeBase, disableBulkActions };
    }
    return { bulkActions: safeBase, disableBulkActions: false };
  } catch {
    return { bulkActions: safeBase, disableBulkActions: false };
  }
}

/**
 * Construye el objeto pasado a `Evaluator.evaluate` para `bulkActionsContextCode`.
 *
 * @param {Object} params
 * @param {object | null | undefined} params.kaceEngine - Instancia devuelta por KaceEngine()
 * @param {unknown} params.apiService
 * @param {{ bulkActions?: unknown[], bulkActionsContextCode?: string }} params.component
 * @returns {Object}
 */
export function buildBulkActionsEvaluationContext({
  kaceEngine,
  apiService,
  component,
}) {
  const storeService = kaceEngine?.getService?.('storeService') ?? null;
  const userService = kaceEngine?.getService?.('user') ?? null;
  const groupService = kaceEngine?.getService?.('group') ?? null;
  const baseBulkActions = Array.isArray(component?.bulkActions)
    ? component.bulkActions
    : [];

  /**
   * Lee el id del grupo activo desde el store (`config.selected_group_id`) o,
   * en su defecto, desde `user.grupo_activo` en datos de usuario en memoria.
   * @returns {string|number|null}
   */
  const getCurrentGroupId = () => {
    try {
      const fromStore = storeService?.get?.(STORE_PATH_SELECTED_GROUP_ID);
      if (fromStore != null && fromStore !== '') return fromStore;
      const user = storeService?.get?.(STORE_PATH_AUTH_USER_DATA);
      const fromUser = user?.user?.grupo_activo;
      return fromUser != null && fromUser !== '' ? fromUser : null;
    } catch {
      return null;
    }
  };

  /**
   * Datos de usuario ya cargados en store (`auth.user_data`), sin llamar a la API.
   * @returns {object|null}
   */
  const getUserDataSync = () => {
    try {
      const u = storeService?.get?.(STORE_PATH_AUTH_USER_DATA);
      return u && typeof u === 'object' ? u : null;
    } catch {
      return null;
    }
  };

  /**
   * Objeto del grupo activo dentro de `groups`, o null.
   * @returns {object|null}
   */
  const getCurrentGroupSync = () => {
    try {
      const id = getCurrentGroupId();
      const userData = getUserDataSync();
      const groups = userData?.groups;
      if (id == null || !Array.isArray(groups)) return null;
      return groups.find((g) => g && g.id === id) ?? null;
    } catch {
      return null;
    }
  };

  /**
   * `configuration_id` asociado al grupo activo en store (si existe).
   * @returns {string|number|null}
   */
  const getCurrentGroupConfigurationIdSync = () => {
    try {
      const g = getCurrentGroupSync();
      if (g?.configuration_id != null) return g.configuration_id;
      return (
        storeService?.get?.(STORE_PATH_CONFIGURATION_ID_SELECTED_GROUP) ?? null
      );
    } catch {
      return null;
    }
  };

  return {
    kaceEngine: kaceEngine ?? undefined,
    apiService: apiService ?? undefined,
    userService: userService ?? undefined,
    groupService: groupService ?? undefined,
    storeService: storeService ?? undefined,
    component,
    baseBulkActions,
    getCurrentGroupId,
    getUserDataSync,
    getCurrentGroupSync,
    getCurrentGroupConfigurationIdSync,
  };
}
