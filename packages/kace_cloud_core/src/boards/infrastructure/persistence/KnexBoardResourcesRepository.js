import { Helper, KnexRepository, QueryDBError, SchemaMetadataCache } from '@kace/core/src/shared';
import { Board } from '../../domain/Board';
import { BoardResources } from '../../domain/BoardResources';
import { Criteria } from '../../../shared';
import { AuxiliaryEntityHelper } from '../../../shared/criteria/AuxiliaryEntityHelper';

export class KnexBoardResourcesRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, '', readerConfig);
    }

    #tableName;

    get tableName() {
        return this.#tableName;
    }

    set tableName(value) {
        this.#tableName = value;
    }

    /**
     * Searches for Board instances according to the given criteria.
     * @param {Object} criteria
     * @returns {Promise<Board[]>}
     */
    async search(criteria, subQuery) {
        try {
            const columnsInfo = await SchemaMetadataCache.getColumnInfo(this.connection, this.tableName);
            criteria.setTableColumns(columnsInfo);

            const reader = this.reader;
            let query = criteria.convertToKnex(reader(this.qualifiedName(this.tableName)).select('*'));
            this.#applyDeletedAtFilter(query, columnsInfo);
            Helper.logDebug2('KnexBoardResourcesRepository::search query:', query.toString());

            // Query externo
            if (subQuery) {
                const hasAuxFilter = subQuery.filter?.some((f) =>
                    AuxiliaryEntityHelper.isAuxiliaryField(f.field?.value || f.field)
                );
                const effectiveRelationships =
                    hasAuxFilter && (!subQuery.relationship || subQuery.relationship.length === 0)
                        ? criteria.relationship
                        : subQuery.relationship;

                const criteria2 = new Criteria(
                    subQuery.filter,
                    effectiveRelationships,
                    subQuery.limit,
                    subQuery.offset,
                    subQuery.order,
                    't'
                );
                const baseQuery32 = criteria2.convertToKnex(reader.from(query.as('t')).select('*'));

                const subQueryRows = await baseQuery32;
                return new BoardResources(subQueryRows, subQueryRows?.length);
            }
            const rows = await query;

            return new BoardResources(rows, rows?.length);
        } catch (error) {
            Helper.logError('Error searching board', error);
            const errorMessage = error?.message?.toLowerCase() || '';
            if (
                errorMessage.includes('column') ||
                errorMessage.includes('relation') ||
                errorMessage.includes('does not exist')
            ) {
                throw new QueryDBError(
                    'custom',
                    `Error al realizar la consulta: columna o relación no válida. Verifique la configuración del board.`
                );
            }
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts board resources applying a subQuery filter.
     * Builds the inner query from criteria (without pagination), wraps it as a subquery,
     * applies subQuery filters, and returns the count.
     * @param {Criteria} criteria - Inner query criteria (without limit/offset)
     * @param {Object} subQuery - SubQuery with filter, relationship, order
     * @returns {Promise<Object>} Row with count property
     */
    async countWithSubQuery(criteria, subQuery) {
        try {
            const columnsInfo = await SchemaMetadataCache.getColumnInfo(this.connection, this.tableName);
            criteria.setTableColumns(columnsInfo);

            const reader = this.reader;
            let query = criteria.convertToKnex(reader(this.qualifiedName(this.tableName)).select('*'));
            this.#applyDeletedAtFilter(query, columnsInfo);

            const hasAuxFilter = subQuery.filter?.some(
                (f) => f.field?.value?.startsWith('aux_') || f.field?.startsWith('aux_')
            );
            const effectiveRelationships =
                hasAuxFilter && (!subQuery.relationship || subQuery.relationship.length === 0)
                    ? criteria.relationship
                    : subQuery.relationship;

            const criteria2 = new Criteria(subQuery.filter, effectiveRelationships, null, null, null, 't');
            const countQuery = criteria2.convertToKnex(reader.from(query.as('t')).count('* as count'));

            const [row] = await countQuery;
            return row;
        } catch (error) {
            Helper.logError('Error counting board resources with subQuery', error);
            throw new QueryDBError('count');
        }
    }

    /*** Counts the number of `boards resources` instances that match the given criteria.
     * @param { Object } criteria - The criteria for the count operation.
     * @returns { Promise < number >} A promise that resolves to the count of matching `User` instances.
     */
    async count(criteria) {
        try {
            const columnsInfo = await SchemaMetadataCache.getColumnInfo(this.connection, this.tableName);
            const query = criteria.convertToKnex(this.reader(this.qualifiedName(this.tableName)).count());
            this.#applyDeletedAtFilter(query, columnsInfo);
            const [row] = await query;
            return row;
        } catch (error) {
            Helper.logError('Error counting board resources', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Counts cases grouped by status applying both base criteria and subQuery filters.
     * Builds the inner query from criteria, wraps it as a subquery, applies subQuery filters,
     * then joins with status tables and groups by status.
     * @param {Criteria} criteria - Inner query criteria (filters + relationships, no pagination)
     * @param {Object} subQuery - SubQuery with filter, relationship, order
     * @param {boolean} hasGroupBy - Whether the inner query uses GROUP BY
     * @returns {Promise<Array<{status: string, count: number, color: string|null}>>} - Array of objects with status name, count and color.
     */
    async searchCountByStatusWithSubQuery(criteria, subQuery, hasGroupBy = false) {
        try {
            const columnsInfo = await SchemaMetadataCache.getColumnInfo(this.connection, this.tableName);
            criteria.setTableColumns(columnsInfo);

            const reader = this.reader;
            let innerQuery = criteria.convertToKnex(reader(this.qualifiedName(this.tableName)).select('*'));
            this.#applyDeletedAtFilter(innerQuery, columnsInfo);

            // TODO(MSKT-1392): deriva el estado en vivo desde transiciones.siguiente_estado_id
            // en vez de leer la columna persistida cases.estado_id — ver el mismo TODO en
            // KnexEventRepository#getStateByTransitionID.
            innerQuery
                .join(this.qualifiedName('transiciones'), `${this.tableName}.transicion_id`, 'transiciones.id')
                .join(this.qualifiedName('estados'), 'transiciones.siguiente_estado_id', 'estados.id')
                .select('estados.nombre as count_by_status_transition', 'estados.color as count_by_status_color');

            if (hasGroupBy || innerQuery.toString().includes('group by')) {
                innerQuery.groupBy('estados.nombre', 'estados.color');
            }

            const hasAuxFilter = subQuery.filter?.some(
                (f) => f.field?.value?.startsWith('aux_') || f.field?.startsWith('aux_')
            );
            const effectiveRelationships =
                hasAuxFilter && (!subQuery.relationship || subQuery.relationship.length === 0)
                    ? criteria.relationship
                    : subQuery.relationship;

            const subCriteria = new Criteria(subQuery.filter, effectiveRelationships, null, null, null, 't');
            const statusQuery = subCriteria.convertToKnex(
                reader
                    .from(innerQuery.as('t'))
                    .select('t.count_by_status_transition', 't.count_by_status_color')
                    .count('* as count')
            );

            statusQuery.groupBy('t.count_by_status_transition', 't.count_by_status_color');

            Helper.logDebug2('searchCountByStatusWithSubQuery query:', statusQuery.toString());
            const rows = await statusQuery;
            return rows.map((row) => ({
                status: row.count_by_status_transition,
                count: parseInt(row.count, 10),
                color: row.count_by_status_color ?? null,
            }));
        } catch (error) {
            Helper.logError('Error counting board resources by status with subQuery', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Counts cases grouped by status applying the given criteria.
     * This method assumes tableName is 'cases' and related tables exist.
     * @param {Criteria} criteria - The criteria to filter cases.
     * @returns {Promise<Array<{status: string, count: number, color: string|null}>>} - Array of objects with status name, count and color.
     */
    async searchCountByStatus(criteria) {
        try {
            const columnsInfo = await SchemaMetadataCache.getColumnInfo(this.connection, this.tableName);
            criteria.setTableColumns(columnsInfo);

            // TODO(MSKT-1392): mismo caso — deriva el estado en vivo en vez de leer cases.estado_id.
            const queryBuilder = this.reader(this.qualifiedName(this.tableName))
                .select('estados.nombre as status', 'estados.color as color')
                .count(`${this.tableName}.id as count`)
                .join(this.qualifiedName('transiciones'), `${this.tableName}.transicion_id`, 'transiciones.id')
                .join(this.qualifiedName('estados'), 'transiciones.siguiente_estado_id', 'estados.id');

            this.#applyDeletedAtFilter(queryBuilder, columnsInfo);

            criteria.convertToKnex(queryBuilder);

            queryBuilder.groupBy('estados.nombre', 'estados.color');

            const rows = await queryBuilder;
            return rows.map((row) => ({
                status: row.status,
                count: parseInt(row.count, 10),
                color: row.color ?? null,
            }));
        } catch (error) {
            Helper.logError('Error counting board resources by status', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Counts rows grouped by an ANS-position field applying the given criteria.
     * Only values 1, 2 and 3 are considered (AnsCalculator: VIGENTE, INTERMEDIO, VENCIDO).
     * @param {Criteria} criteria - The criteria to filter rows.
     * @param {string} ansField - Fully qualified field name (e.g. 'cases.ans_posicion').
     * @returns {Promise<Array<{id: number, count: number}>>}
     */
    async searchCountByAns(criteria, ansField) {
        try {
            const columnsInfo = await SchemaMetadataCache.getColumnInfo(this.connection, this.tableName);
            criteria.setTableColumns(columnsInfo);

            const queryBuilder = this.table(this.tableName)
                .select(`${ansField} as ans_position`)
                .count(`${this.tableName}.id as count`)
                .whereIn(ansField, [1, 2, 3]);

            this.#applyDeletedAtFilter(queryBuilder, columnsInfo);

            criteria.convertToKnex(queryBuilder);

            queryBuilder.groupBy(ansField);

            const rows = await queryBuilder;
            return rows.map((row) => ({
                id: parseInt(row.ans_position, 10),
                count: parseInt(row.count, 10),
            }));
        } catch (error) {
            Helper.logError('Error counting board resources by ans', error);
            throw new QueryDBError('count');
        }
    }

    #applyDeletedAtFilter(query, columnsInfo) {
        if (columnsInfo.deleted_at) {
            query.whereNull(`${this.tableName}.deleted_at`);
        }
    }
}
