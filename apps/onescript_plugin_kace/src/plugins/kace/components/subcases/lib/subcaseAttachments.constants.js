/**
 * Textos fijos para confirmación de borrado de adjuntos de subcaso (SweetAlert2).
 */
export const SUBCASE_ATTACHMENT_DELETE_SWAL_TITLE = '¿Eliminar archivo?';
export const SUBCASE_ATTACHMENT_DELETE_SWAL_CONFIRM = 'Sí, eliminar';
export const SUBCASE_ATTACHMENT_DELETE_SWAL_CANCEL = 'Cancelar';
export const SUBCASE_ATTACHMENT_DELETE_SWAL_TEXT_TEMPLATE =
  '¿Confirma que desea eliminar "{fileName}"? Esta acción no se puede deshacer.';

/**
 * @param {string} fileName
 * @returns {string}
 */
export function getSubcaseAttachmentDeleteSwalText(fileName) {
  const safe = fileName != null ? String(fileName) : '';
  return SUBCASE_ATTACHMENT_DELETE_SWAL_TEXT_TEMPLATE.replace(
    '{fileName}',
    safe
  );
}
