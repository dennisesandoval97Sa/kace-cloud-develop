import { CustomError } from '../../../shared/index.js';
import { ReportExecutionFinder as DomainReportExecutionFinder } from '../../domain/ReportExecutionFinder.js';
import { ReportExecutionResponse } from '../ReportExecutionResponse.js';

export class ReportExecutionFinder {
    /** @type {DomainReportExecutionFinder} */
    #finder;

    /**
     * @param {KnexReportExecutionsRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainReportExecutionFinder(repository);
    }

    /**
     * Execute find by id and return a ReportExecutionResponse
     * @param {string} id
     * @returns {Promise<ReportExecutionResponse>}
     */
    async execute(id) {
        const reportExecution = await this.#finder.execute(id);

        if (!reportExecution || reportExecution.isDeleted()) {
            throw new CustomError('Report Execution not found', 404);
        }

        return new ReportExecutionResponse(reportExecution);
    }
}

export default ReportExecutionFinder;
