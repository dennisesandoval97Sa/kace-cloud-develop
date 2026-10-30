export class ReportDistinctValuesFinder {
    constructor(reportViewRepository) {
        this.reportViewRepository = reportViewRepository;
    }

    /**
     * Fetch paginated distinct non-null values for a field in a report view,
     * formatted as { id, label, value } objects for use in UI selects.
     * @param {string} reportName - name of the DB view
     * @param {string} fieldName - column to get distinct values from
     * @param {{ limit?: number, offset?: number, search?: string }} options
     * @returns {Promise<{ items: Array<{id, label, value}>, total: number }>}
     */
    async execute(reportName, fieldName, options = {}) {
        const { values, total } = await this.reportViewRepository.getDistinctFieldValues(
            reportName,
            fieldName,
            options
        );
        const items = values.map((val) => ({
            id: val,
            label: String(val),
            value: val,
        }));
        return { items, total };
    }
}
