import { CanUpdateCase } from '../../shared/index.js';
import { CustomError } from '../../shared/errors/CustomError.js';

/**
 * Same write gates CaseUpdater applies before mutating a case.
 * Used by the audit-only auxiliary shortcut so it cannot skip 404 / CanUpdateCase / closed-case.
 *
 * @param {import('../domain/Case.js').Case|null|undefined} kase
 * @param {import('../../users/domain/User.js').User|null|undefined} user
 * @param {{ allowUpdateClosedCase?: boolean }} [options]
 */
export function guardCaseWrite(kase, user, { allowUpdateClosedCase = false } = {}) {
    if (kase == null) {
        throw new CustomError('The Case you are trying update does not exist', 404);
    }
    if (user && !CanUpdateCase.check(user, kase)) {
        throw new CustomError('You do not have permission to update this case', 403);
    }
    if (kase.fecha_resolucion?.value && !allowUpdateClosedCase) {
        throw new CustomError('The case is already resolved; updates are not allowed.', 403);
    }
}
