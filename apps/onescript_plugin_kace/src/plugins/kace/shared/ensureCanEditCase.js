import Swal from 'sweetalert2';

/**
 * Blocks the submit flow when the current user cannot edit the case
 * (not the responsable and no CaseUpdateNotOwner permission) or the
 * case is explicitly locked in the store. Shows the same warning
 * alert used across all "submit" component variants.
 *
 * @param {ReturnType<typeof import('#plugins/kace/KaceEngine.js').KaceEngine>} kaceEngine
 * @param {typeof Swal} [swal]
 * @returns {Promise<boolean>} true when the submit must be blocked
 */
export async function ensureCanEditCase(kaceEngine, swal = Swal) {
  const userService = kaceEngine.getService('user');
  const caseEditLocked = Boolean(
    kaceEngine.getService('storeService')?.get?.('cases.case_edit_locked')
  );

  const blocked =
    caseEditLocked ||
    (typeof userService?.canEditCaseSync === 'function' &&
      !userService.canEditCaseSync());

  if (!blocked) return false;

  await swal.fire({
    icon: 'warning',
    title: 'Sin permiso',
    text: 'No tiene permiso para actualizar este caso porque no es el responsable.',
    confirmButtonText: 'Entendido',
  });
  return true;
}
