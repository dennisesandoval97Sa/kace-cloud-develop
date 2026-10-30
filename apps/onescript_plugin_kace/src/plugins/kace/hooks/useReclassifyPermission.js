import { useCallback, useEffect, useState } from 'react';
import { KaceEngine } from '../KaceEngine';
import { hasNamespacedRolePermission } from '#plugins/kace/shared/hasNamespacedRolePermission.js';
import { STORE_PATH_HANDSHAKE_PARAMS } from '#plugins/kace/utils/withHandshakeEvaluatorContext.js';

/**
 * Debe reflejar `CASE_RECLASSIFY_PERMISSION` en
 * `@kace/core/src/shared/domain/rules/CanUseCapability.js` (SSOT del backend): el permiso
 * autoriza si está concedido en CUALQUIERA de los `namespaces` del rol. Exportadas (y no solo
 * comentadas) para que `useReclassifyPermission.test.js` pueda comparar estos valores en runtime
 * contra el archivo fuente del backend — un comentario no detecta que el backend cambió y este
 * bundle, que no puede importar `@kace/core`, se quedó atrás.
 */
export const RECLASSIFY_PERMISSION_NAME = 'CaseReclassify';
export const RECLASSIFY_PERMISSION_NAMESPACES = ['administrador', 'agente'];

/**
 * El SPA envía en el handshake `role_namespace` según la vista que embebe el formulario
 * (`/agent/update` → `agente`, `/cases/update` → `administrador`); el permiso solo se evalúa en
 * ese namespace. Sin valor reconocido no hay namespace: suponer uno validaría el permiso de otro
 * rol.
 *
 * @param {{ role_namespace?: string } | null} handshakeParams
 * @returns {string | null}
 */
function resolveRoleNamespace(handshakeParams) {
  const roleNamespace = handshakeParams?.role_namespace;
  return RECLASSIFY_PERMISSION_NAMESPACES.includes(roleNamespace)
    ? roleNamespace
    : null;
}

/**
 * Lee el permiso de rol `CaseReclassify` (BUG-4, MSKT-1392) del store, con el mismo shape que
 * usa `userService.canEditCaseSync()`: `userData.permisions.<namespace>`.
 *
 * Vive fuera de `useReclassifyUnlockGate` para poder mockearse en tests igual que
 * `useGlobalConfig`, y porque `kaceAuthData` puede resolver después del montaje (el store todavía
 * no tiene `user.user_data` cuando el formulario arranca).
 *
 * @param {Function} onEvent
 * @param {Function} [offEvent]
 * @returns {boolean}
 */
export function useReclassifyPermission(onEvent, offEvent) {
  const [hasPermission, setHasPermission] = useState(false);

  const readPermission = useCallback(() => {
    try {
      const kaceEngine = KaceEngine();
      const storeService = kaceEngine?.getService?.('storeService');
      const userData =
        storeService?.get?.('user.user_data') ??
        storeService?.get?.('auth.user_data');
      const roleNamespace = resolveRoleNamespace(
        storeService?.get?.(STORE_PATH_HANDSHAKE_PARAMS)
      );
      if (!roleNamespace) return false;
      return hasNamespacedRolePermission(userData, {
        namespaces: [roleNamespace],
        permissionName: RECLASSIFY_PERMISSION_NAME,
      });
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    setHasPermission(readPermission());
    const onAuth = () => setHasPermission(readPermission());
    onEvent('kaceAuthData', onAuth);
    return () => {
      offEvent?.('kaceAuthData', onAuth);
    };
  }, [onEvent, offEvent, readPermission]);

  return hasPermission;
}

export default useReclassifyPermission;
