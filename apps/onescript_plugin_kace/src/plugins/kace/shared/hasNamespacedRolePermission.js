/**
 * Comprueba si `userData.permisions.<namespace>` trae un permiso `granted: true`, para
 * CUALQUIERA de los `namespaces` dados.
 *
 * Extraído (BUG-4, MSKT-1392) porque el mismo `permisions.<namespace>.filter(name === X)`
 * vivía duplicado en `userService.canEditCaseSync()`, `userService.userCanEditCase()` y
 * `KaceData.js` — cada copia con su propia variación (`.filter()[0].granted` vs `.some()`).
 *
 * @param {{ permisions?: Record<string, Array<{ name?: string, granted?: boolean }>> } | null | undefined} userData
 * @param {Object} params
 * @param {readonly string[]} params.namespaces - Namespaces de rol a revisar, en orden.
 * @param {string} params.permissionName
 * @returns {boolean}
 */
export function hasNamespacedRolePermission(
  userData,
  { namespaces, permissionName }
) {
  return namespaces.some((namespace) =>
    userData?.permisions?.[namespace]?.some(
      (item) => item?.name === permissionName && item?.granted === true
    )
  );
}

export default hasNamespacedRolePermission;
