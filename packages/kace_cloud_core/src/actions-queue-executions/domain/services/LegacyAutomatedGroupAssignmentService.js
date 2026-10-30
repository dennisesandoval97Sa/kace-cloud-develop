import { AutomatedGroupAssignmentService } from './AutomatedGroupAssignmentService.js';

/**
 * Legacy wrapper around AutomatedGroupAssignmentService that intentionally omits
 * the SQL prefilter collaborators (`entityCandidateFinder`, `caseContextBatchLoader`).
 *
 * This forces the inner service into passive mode, preserving the pre-prefilter
 * behavior: load the full active-case universe per action and rely on per-case
 * context lookups inside validators. Used as the fallback path when the
 * `AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED` feature flag is unset.
 */
export class LegacyAutomatedGroupAssignmentService {
    #inner;

    constructor(caseActionValidator, deps) {
        this.#inner = new AutomatedGroupAssignmentService(caseActionValidator, deps);
    }

    async assign(args) {
        return this.#inner.assign(args);
    }
}
