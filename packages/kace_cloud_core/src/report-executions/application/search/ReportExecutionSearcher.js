import { Criteria } from '../../../shared';
import { Counter } from '../../../shared/domain/Counter';
import { ReportExecutionCollectionResponse } from '../ReportExecutionCollectionResponse';

export class ReportExecutionSearcher {
    /**
     * @type {KnexReportExecutionsRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {Counter} is initialized in the constructor
     */
    #counter;

    /**
     * @param {KnexAgendasGroupsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Search for report executions.
     *
     * @param {Object} dto - The data transfer object.
     * @param {Array<object>} dto.filter - The filter criteria.
     * @param {Array<object>} dto.relationship - The relationship criteria.
     * @param {number} dto.limit - The maximum number of records to return.
     * @param {number} dto.offset - The number of records to skip.
     * @param {string} dto.order - The order criteria.
     *
     * @returns {Promise<ReportExecutionCollectionResponse>} - Promise that resolves with the report executions found
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;

        relationship = [
            {
                table: 'usuarios',
                condition: {
                    column: 'usuarios.id',
                    refColumn: `${tablename}.issued_by`,
                },
                type: 'left',
            },
        ];
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const countResult = await this.#counter.execute({
            filter,
            relationship,
            limit,
            offset,
            order,
        });

        let total = 0;
        if (typeof countResult === 'number') {
            total = countResult;
        } else if (countResult && typeof countResult.count !== 'undefined') {
            total = Number(countResult.count);
        } else if (Array.isArray(countResult) && countResult.length) {
            const first = countResult[0];
            total = Number(first.count ?? first['count'] ?? first['count(*)'] ?? 0);
        }

        return new ReportExecutionCollectionResponse(rows, total);
    }
}
