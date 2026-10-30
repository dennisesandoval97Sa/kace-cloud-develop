import { ValidationFailError, Helper } from '../../../shared/index.js';
import ReportExecution from '../../domain/ReportExecutions.js';

/**
 * Creator that persists a ReportExecution record in the DB.
 * - Validates duplicates by `name` + `period` (strict JSON equality)
 * - Saves to provided repository
 */
export class ReportExecutionsCreator {
    /** @type {import('../infrastructure/persistence/KnexReportExecutionsRepository.js').default} */
    #repository;

    /**
     * @param {object} repository KnexReportExecutionsRepository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Create and persist a ReportExecution
     * @param {Object} dto
     * @returns {Promise<ReportExecution>}
     */
    async execute(dto) {
        // build domain
        const report = ReportExecution.create(dto);

        // validate issued_by refers to an existing user (usuarios)
        try {
            const issuedById = report.issued_by?.value ?? report.issued_by ?? null;
            if (!issuedById) {
                throw new ValidationFailError('issued_by is required', 'report_executions');
            }

            if (this.#repository && this.#repository.connection) {
                const userRow = await this.#repository
                    .connection(this.#repository.qualifiedName('usuarios'))
                    .select('id')
                    .where({ id: issuedById })
                    .first();
                if (!userRow) {
                    throw new ValidationFailError(`issued_by user not found: ${issuedById}`, 'report_executions');
                }
            }
        } catch (err) {
            Helper.logError(err);
            if (err instanceof ValidationFailError) throw err;
            // unexpected DB error -> wrap
            throw new ValidationFailError(`Error validating issued_by: ${err?.message ?? err}`, 'report_executions');
        }

        // persist
        const saved = await this.#repository.save(report);

        if (saved && saved.id) {
            return saved;
        }

        return report;
    }
}
