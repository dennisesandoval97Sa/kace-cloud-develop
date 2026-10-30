export const CASE_EDIT_LOCKED_STORE_KEY = 'cases.case_edit_locked';

export function resolveKaceDisabledClassName({
  disabled = false,
  readOnlyLock = false,
} = {}) {
  if (!disabled) return '';
  if (readOnlyLock) return '';
  return 'kace-component--disabled';
}
