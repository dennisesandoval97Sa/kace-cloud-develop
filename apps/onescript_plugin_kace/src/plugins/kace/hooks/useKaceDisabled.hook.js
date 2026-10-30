import { useMemo } from 'react';
import { storeService } from '#plugins/kace/services/storeService.js';
import {
  CASE_EDIT_LOCKED_STORE_KEY,
  resolveKaceDisabledClassName,
} from '#plugins/kace/utils/kaceFormDisabled.js';

// Default lock key is the case-edit store flag. Pass `readOnlyStoreKey: null`
// to opt out (generic Form.io disabled keeps the overlay class).
export function useKaceDisabled(
  disabled = false,
  { readOnlyStoreKey = CASE_EDIT_LOCKED_STORE_KEY } = {}
) {
  const readOnlyLock = Boolean(
    readOnlyStoreKey && storeService.get(readOnlyStoreKey)
  );
  const isDisabled = Boolean(disabled || readOnlyLock);

  const className = useMemo(
    () => resolveKaceDisabledClassName({ disabled: isDisabled, readOnlyLock }),
    [isDisabled, readOnlyLock]
  );

  return { disabled: isDisabled, readOnlyLock, className };
}
