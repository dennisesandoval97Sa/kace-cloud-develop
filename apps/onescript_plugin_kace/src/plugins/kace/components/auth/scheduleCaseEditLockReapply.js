import { storeService } from '#plugins/kace/services/storeService.js';
import { applyCaseEditLock } from './applyCaseEditLock.js';

const REAPPLY_DELAYS_MS = [0, 250, 750, 1500, 3000, 5000];

export function scheduleCaseEditLockReapply(formRoot) {
  if (!formRoot || !storeService.get('cases.case_edit_locked')) {
    return;
  }

  for (const delayMs of REAPPLY_DELAYS_MS) {
    setTimeout(() => {
      if (!storeService.get('cases.case_edit_locked')) return;
      applyCaseEditLock(formRoot, { locked: true });
    }, delayMs);
  }
}
