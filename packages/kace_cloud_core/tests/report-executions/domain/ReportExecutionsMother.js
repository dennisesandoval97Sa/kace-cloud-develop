import { v4 as uuidv4 } from 'uuid';
import ReportExecution from '../../../src/report-executions/domain/ReportExecutions.js';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export default class ReportExecutionsMother {
    /**
     * `report_executions.issued_by` es una FK real contra `usuarios` que nunca se
     * respaldo: esta factoria inventa el id con `uuidv4()`.
     *
     * Se garantiza SIEMPRE, tambien cuando el llamador fijo el id: `ensureParentRow`
     * es idempotente. La columna sale de pg_constraint.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [{ table: 'usuarios', id: dto.issued_by }]);
    }

    static dto(overrides = {}) {
        return {
            id: uuidv4(),
            name: 'Monthly Summary',
            issued_by: uuidv4(),
            period: { field: 'created_at', initial_date: '2025-11-01', end_date: '2025-11-30' },
            conditions: [{ field: 'status', operator: 'equals', value: 'closed', type: 'AND' }],
            s3_file: 's3://bucket/reports/monthly.xlsx',
            created_at: new Date(),
            created_by: uuidv4(),
            ...overrides,
        };
    }

    static randomDto() {
        return {
            id: uuidv4(),
            name: `Report-${uuidv4().slice(0, 8)}`,
            issued_by: uuidv4(),
            period: { field: 'created_at', initial_date: new Date().toISOString(), end_date: new Date().toISOString() },
            conditions: [{ field: 'random', operator: 'equals', value: true, type: 'AND' }],
            s3_file: null,
            created_at: new Date(),
            created_by: uuidv4(),
        };
    }

    static createDomain(overrides = {}) {
        const dto = { ...this.dto(), ...overrides };
        return ReportExecution.create(dto);
    }

    static async createReport(repository, overrides = {}) {
        const dto = { ...this.dto(), ...overrides };
        const report = ReportExecution.create(dto);
        if (repository && typeof repository.save === 'function') {
            await ReportExecutionsMother.ensureRelations(repository.connection, dto);
            await repository.save(report);
        }
        return report;
    }
}
