import { Helper, KnexRepository } from '../../../shared/index.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { ReportExecution } from '../../domain/ReportExecutions.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

/**
 * Focused repository for report_executions table.
 * Implements basic CRUD operations tailored to the table structure:
 *  - id, name, issued_by, period (jsonb), conditions (jsonb), s3_file
 *  - audit fields: created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
 */
export class KnexReportExecutionsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'report_executions', readerConfig);
    }

    /**
     *
     * @param {ReportExecution} report
     * @returns {Promise<ReportExecution>}
     */
    async save(report) {
        try {
            DbRequestContext.markWrite();
            const payload = {
                id: report.id?.value ?? report.id,
                name: report.name?.value ?? report.name,
                issued_by:
                    report.issued_by?.value ??
                    report.issuedBy?.value ??
                    report.issued_by_id?.value ??
                    report.issued_by ??
                    null,
                period: JSON.stringify(report.period?.value),
                conditions: JSON.stringify(report.conditions?.value),
                s3_file:
                    report.s3_file?.value ?? report.s3File ?? report.storage_path?.value ?? report.storagePath ?? null,
                created_at: report.created_at?.value,
                created_by: report.created_by?.value ?? report.createdBy ?? null,
                status: report.status?.value ?? 'pending',
                result: report.result?.value ? JSON.stringify(report.result.value) : null,
                error: report.error?.value ? JSON.stringify(report.error.value) : null,
                started_at: report.started_at?.value ?? null,
                completed_at: report.completed_at?.value ?? null,
            };

            const [inserted] = await this.table().insert(payload).returning('*');
            return new ReportExecution(inserted);
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('save');
        }
    }

    /**
     *
     * @param {import('../../../shared/domain/value-object/ValueObjectUuid.js').ValueObjectUuid} id
     * @returns {Promise<ReportExecution|null>}
     */
    async find(id) {
        try {
            const result = await this.read.table('report_executions').where({ id: id.value }).first();
            return result ? new ReportExecution(result) : null;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('find');
        }
    }

    async findAll(filters = {}) {
        try {
            const qb = this.read.table('report_executions').select('*');
            Object.entries(filters).forEach(([k, v]) => qb.where(k, v));
            qb.whereNull(`${this.tableName}.deleted_by`);
            const rows = await qb;
            return rows;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('findAll');
        }
    }

    /**
     * Generic search entry used by higher-level searchers.
     * Delegates to shared KnexRepository.advancedSearch to apply Criteria.
     * @param {Criteria} criteria
     * @returns {Promise<Array<object>>}
     */
    async search(criteria) {
        try {
            const select = [
                `${this.tableName}.*`,
                `usuarios.nombres AS user_names`,
                'usuarios.apellido1 AS user_apellido1',
                'usuarios.apellido2 AS user_apellido2',
            ];
            const query = criteria.convertToKnex(this.read.table('report_executions').select(select));
            query.whereNull(`${this.tableName}.deleted_at`);
            const rows = await query;
            return rows.map((row) => new ReportExecution(row));
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts report executions matching the criteria. Overrides the base count() to read from the
     * replica (offloads the search counter).
     * @param {Criteria} criteria
     * @returns {Promise<object>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('report_executions').count());
            query.whereNull(`${this.tableName}.deleted_at`);

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('count');
        }
    }
}

export default KnexReportExecutionsRepository;
