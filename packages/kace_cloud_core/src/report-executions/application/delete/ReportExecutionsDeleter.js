import { CustomError } from '../../../shared/errors/CustomError.js';
import { ReportExecutionFinder as DomainReportExecutionFinder } from '../../domain/ReportExecutionFinder.js';

/**
 * Deleter for ReportExecution records.
 * Uses the repository to check existence and perform a soft delete.
 */
export class ReportExecutionsDeleter {
    /** @type {DomainReportExecutionFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexReportExecutionsRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainReportExecutionFinder(repository);
    }

    /**
     * Execute deletion (soft-delete) of a report execution
     * @param {string} id
     * @param {{deleted_at?: string, deleted_by?: string}} dto
     */
    async execute(id, dto = {}) {
        const existing = await this.#finder.execute(id);

        if (!existing) {
            throw new CustomError(`ReportExecution with id ${id} does not exist.`, 404);
        }

        existing.delete({
            deleted_at: dto.deleted_at ?? new Date().toISOString(),
            deleted_by: dto.deleted_by ?? null,
        });

        await this.#repository.delete(existing);
        existing.flushChanges();
    }
}

export default ReportExecutionsDeleter;
