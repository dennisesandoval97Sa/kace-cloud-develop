import { CaseFinder as DomainCaseFinder } from '../domain/CaseFinder.js';
import { guardCaseWrite } from './guardCaseWrite.js';

/**
 * Audit-only auxiliary update: persist `updated_at` / `updated_by` without
 * loading the aggregate into CaseUpdater.
 *
 * Skips `CaseUpdated` / `EDIT_CASE` events, `saveHistory`, and SLA recalculation.
 * Callers that need those side effects must send a domain field so the payload
 * is not classified as audit-only.
 */
export class CaseAuditTouch {
    #repository;
    #user;

    /**
     * @param {import('../infrastructure/persistence/KnexCaseRepository.js').KnexCaseRepository} repository
     * @param {import('../../users/domain/User.js').User|null|undefined} user
     */
    constructor(repository, user) {
        this.#repository = repository;
        this.#user = user;
    }

    /**
     * @param {string} caseId
     * @param {{ updated_at: string|Date, updated_by: string }} audit
     * @param {{ allowUpdateClosedCase?: boolean }} [options]
     */
    async execute(caseId, audit, { allowUpdateClosedCase = false } = {}) {
        const kase = await new DomainCaseFinder(this.#repository).execute(caseId);
        guardCaseWrite(kase, this.#user, { allowUpdateClosedCase });
        await this.#repository.touchUpdatedAt(caseId, {
            updated_at: audit.updated_at,
            updated_by: audit.updated_by,
        });
    }
}
