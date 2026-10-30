import { CanUseCapability, CASE_RECLASSIFY_PERMISSION } from '@kace/core/src/shared/index.js';

/**
 * La definición del permiso vive en `@kace/core` (`CASE_RECLASSIFY_PERMISSION`), que es también
 * quien lo comprueba dentro del dominio en `CaseUpdater`. Aquí solo se reexporta el gate para los
 * Lambdas: dos capas que preguntan lo mismo a la misma definición, no dos listas que divergen.
 */
export const CASE_RECLASSIFY_PERMISSION_NAMESPACES = CASE_RECLASSIFY_PERMISSION.namespaces;

/**
 * @param {{ hasPermission: (namespace: string, moduleId: string, name: string) => boolean }} user
 * @returns {boolean} `true` si el usuario tiene `CaseReclassify` en cualquiera de los namespaces.
 */
export const hasCaseReclassifyPermission = (user) => CanUseCapability.check(user, CASE_RECLASSIFY_PERMISSION);
