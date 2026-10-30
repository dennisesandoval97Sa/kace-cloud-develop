import { Criteria } from '../../../shared/index.js';

export default class AppointmentCounterByCase {
    /**
     *
     * @param {KnexAppointmentRepository} repository
     */
    constructor(repository) {
        this.repository = repository;
    }

    async execute(caseId) {
        const filters = [
            {
                field: 'case_id',
                operator: 'eq',
                value: caseId,
                type: 'AND',
            },
            {
                field: 'is_completed',
                operator: 'eq',
                value: false,
                type: 'AND',
            },
            {
                field: 'is_canceled',
                operator: 'eq',
                value: false,
                type: 'AND',
            },
            {
                field: 'deleted_at',
                operator: 'null',
                value: 'null',
                type: 'AND',
            },
        ];
        const tablename = this.repository.tableName;
        const criteria = new Criteria(filters, null, null, null, null);

        return await this.repository.countByCase(criteria);
    }
}
