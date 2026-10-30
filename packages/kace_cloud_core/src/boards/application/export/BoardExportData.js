import { BoardCriteriaFormat } from '../../domain/BoardCriteriaFormat.js';
import { Criteria } from '../../../shared/criteria/Criteria.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';
import { BOARD_EXPORT_NO_RECORDS } from '@kace/error-codes';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { DateFormatter } from '../../infrastructure/formatters/DateFormatter.js';
import { TenantContext } from '../../../shared/index.js';
import { applyCaseInsensitiveOrders } from '../../domain/applyCaseInsensitiveOrders.js';
import { BoardUnifiedStatusPolicy } from '../../domain/BoardUnifiedStatusPolicy.js';
import { ALLOWED_CRITERIA_FUNCTIONS } from '../../../shared/criteria/allowedCriteriaFunctions.js';

/**
 * Application service for exporting board resources data to Excel format.
 * Handles board-specific query building and data formatting before delegating to ExportExcelData.
 */
export class BoardExportData {
    /** @type {KnexBoardResourcesRepository} */
    #repository;

    /** @type {BoardCriteriaFormat} */
    #criteriaFormatter;

    /** @type {ExportExcelData} */
    #exportService;

    /**
     * @param {KnexBoardResourcesRepository} repository - Repository with dynamic tableName
     * @param {string} tablename - Primary table name for queries
     * @param {ExportExcelData} exportService - Export service for generating Excel files
     */
    constructor(repository, tablename, exportService) {
        this.#repository = repository;
        this.#repository.tableName = tablename;
        this.#criteriaFormatter = new BoardCriteriaFormat();
        this.#exportService = exportService;
    }

    /**
     * Exports board resources data to Excel format and uploads to S3.
     * Receives the same dtoCriteria structure as BoardResourcesSearch but exports ALL matching data
     * (pagination is ignored for exports).
     *
     * @param {Object} dtoCriteria - Criteria object (same structure as BoardResourcesSearch)
     * @param {Array} dtoCriteria.filter - Filter conditions
     * @param {Array} dtoCriteria.relationship - JOIN definitions
     * @param {number} dtoCriteria.limit - Pagination limit (ignored for exports)
     * @param {number} dtoCriteria.offset - Pagination offset (ignored for exports)
     * @param {Array} dtoCriteria.orders - Sort order definitions
     * @param {string} dtoCriteria.tableName - Primary table name
     * @param {Array} dtoCriteria.select - Column definitions with functions and aliases
     * @param {Array} dtoCriteria.having - HAVING clause conditions for aggregates
     * @param {Object|boolean} dtoCriteria.subQuery - Optional nested query criteria
     * @param {Object} options - Optional configuration
     * @param {string} options.fileName - Custom file name (defaults to tableName_export)
     * @returns {Promise<string>} Pre-signed download URL for the Excel file
     * @throws {ValidationFailError} If no data is found matching the criteria
     */
    async execute(dtoCriteria, options = {}) {
        const { fileName } = options;
        const { tableName } = dtoCriteria;

        const tz = TenantContext.getConfig('timezone.value') || 'UTC';

        Helper.logDebug(`Starting board export for table: ${tableName}`);

        const criteria = this.#buildQuery(dtoCriteria);
        let subQuery = dtoCriteria.subQuery;
        if (subQuery) {
            subQuery = {
                ...subQuery,
                limit: null,
                offset: null,
                filter: Array.isArray(subQuery.filter)
                    ? BoardUnifiedStatusPolicy.expandFilters(subQuery.filter, dtoCriteria.select, 't')
                    : subQuery.filter,
            };
            if (subQuery?.order) {
                applyCaseInsensitiveOrders(subQuery.order, dtoCriteria.select);
            }
        }
        const boardResources = await this.#repository.search(criteria, subQuery);
        if (!boardResources.rows || boardResources.rows.length === 0) {
            Helper.logDebug('No data found for export');
            throw new ValidationFailError(
                `No se encontraron registros en "${tableName}" que coincidan con el criterio de búsqueda.`,
                'criteria',
                [],
                BOARD_EXPORT_NO_RECORDS
            );
        }

        Helper.logDebug(`Retrieved ${boardResources.rows.length} rows for export`);

        this.#criteriaFormatter.formatRows(boardResources.rows);

        const alreadyFormatted = new Set(this.#criteriaFormatter.getFormatters().map((f) => f.alias));

        const isStillADate = (col) => {
            if (col.data_type !== 'DATE') return false;
            const key = col.alias || col.field;
            if (alreadyFormatted.has(key)) return false;
            if (!col.function) return true;
            const fn = col.function.toLowerCase();
            return (
                fn === ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions.MIN ||
                fn === ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions.MAX
            );
        };

        const dateColumns = dtoCriteria.select.filter(isStillADate).map((col) => ({
            key: col.alias || col.field,
            format: col.format || 'YYYY/MM/DD HH:MM:SS',
        }));

        const formattedRows = boardResources.rows.map((row) => {
            const newRow = { ...row };

            dateColumns.forEach(({ key, format }) => {
                if (newRow[key] !== null && newRow[key] !== undefined) {
                    newRow[key] = DateFormatter.format(newRow[key], format, tz);
                }
            });

            return newRow;
        });
        const headers = this.#extractHeaders(dtoCriteria.select);

        const finalFileName = fileName || `${tableName}_export`;

        const downloadUrl = await this.#exportService.execute(formattedRows, finalFileName, headers);

        Helper.logDebug(`Board export completed: ${downloadUrl}`);

        return { data: { downloadUrl } };
    }

    /**
     * Builds query criteria from dtoCriteria (same logic as BoardResourcesSearch).
     * NOTE: Pagination is ignored for exports - all matching data is exported.
     * @param {Object} dtoCriteria - Criteria object
     * @returns {Criteria} - Standardized Criteria object
     * @private
     */
    #buildQuery(dtoCriteria) {
        const { orders, tableName } = dtoCriteria;

        let selectColumns = this.#criteriaFormatter.buildSelectColumns(dtoCriteria.select);

        let relationships = [];
        if (dtoCriteria.relationship && Array.isArray(dtoCriteria.relationship)) {
            relationships = this.#criteriaFormatter.buildRelationships(dtoCriteria.relationship);
        }

        let filters = null;
        if (dtoCriteria.filter && Array.isArray(dtoCriteria.filter)) {
            const expanded = BoardUnifiedStatusPolicy.expandFilters(
                dtoCriteria.filter,
                dtoCriteria.select,
                dtoCriteria.tableName
            );
            filters = this.#criteriaFormatter.buildFilters(expanded);
        }

        let groupByColumns = dtoCriteria.select.filter((col) => col.group_by === true && col.function === null);
        if (groupByColumns.length > 0) {
            groupByColumns = groupByColumns.map((col) => `${col.entity}.${col.field}`);
            const concatCols = dtoCriteria.select.filter(
                (col) => col.function === ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT
            );
            concatCols.forEach((col) => {
                (col.concat_sources ?? []).forEach((source) => {
                    const sourceField = `${source.entity}.${source.field}`;
                    if (!groupByColumns.includes(sourceField)) {
                        groupByColumns.push(sourceField);
                    }
                });
            });
        } else {
            selectColumns = [`${tableName}.id as id`, ...selectColumns];
            groupByColumns = null;
        }

        let having = null;
        if (dtoCriteria.having && Array.isArray(dtoCriteria.having)) {
            having = this.#criteriaFormatter.buildHavings(dtoCriteria.having);
        }

        const exportLimit = null;
        const exportOffset = null;

        return new Criteria(
            filters,
            relationships,
            exportLimit,
            exportOffset,
            orders,
            tableName,
            selectColumns,
            groupByColumns,
            having
        );
    }

    /**
     * Extracts header names from select columns using aliases when available.
     * @param {Array} selectColumns - Array of column definitions
     * @returns {Array<string>} - Array of header names
     * @private
     */
    #extractHeaders(selectColumns) {
        return selectColumns.map((col) => col.alias || col.field);
    }
}
