import { ValueObjectUuid } from '../../shared/index.js';
import ReportExecution from './ReportExecutions.js';

export class ReportExecutionFinder {
    /** @type {KnexReportExecutionsRepository} */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Find a ReportExecution by id
     * @param {string} id
     * @returns {Promise<ReportExecution|null>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}

export default ReportExecutionFinder;
