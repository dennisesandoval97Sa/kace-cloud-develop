import { assertValidIdentifier } from '../shared/identifier.js';

/**
 * Resolved synchronization plan for a single table: which columns to copy,
 * which key to upsert on, and which columns were dropped due to schema drift.
 */
export class TableSyncPlan {
    #sourceSchema;
    #sourceTable;
    #targetSchema;
    #targetTable;
    #columns;
    #ignoredColumns;
    #primaryKey;
    #where;

    constructor({ sourceSchema, sourceTable, targetSchema, targetTable, columns, ignoredColumns, primaryKey, where }) {
        this.#sourceSchema = sourceSchema;
        this.#sourceTable = sourceTable;
        this.#targetSchema = targetSchema;
        this.#targetTable = targetTable;
        this.#columns = columns;
        this.#ignoredColumns = ignoredColumns;
        this.#primaryKey = primaryKey;
        this.#where = where;
    }

    /**
     * Builds a plan from both sides' introspected metadata.
     *
     * @param {Object} params - Build parameters.
     * @param {Object} params.table - Table entry from the config file.
     * @param {string} params.sourceSchema - Source schema name.
     * @param {string} params.targetSchema - Target schema name.
     * @param {string[]} params.sourceColumns - Column names in the source table.
     * @param {string[]} params.targetColumns - Column names in the target table.
     * @param {string[]} params.primaryKey - Primary key column names from the source.
     * @returns {TableSyncPlan} The resolved plan.
     * @throws {Error} When the table has no primary key or the key is missing in the target.
     */
    static build({ table, sourceSchema, targetSchema, sourceColumns, targetColumns, primaryKey }) {
        const sourceTable = assertValidIdentifier(table.name, 'table');
        const targetTable = assertValidIdentifier(table.targetName ?? table.name, 'table');

        if (primaryKey.length === 0) {
            throw new Error(`Table "${sourceTable}" has no primary key; cannot upsert`);
        }

        const sourceColumnSet = new Set(sourceColumns);

        for (const column of primaryKey) {
            if (!sourceColumnSet.has(column)) {
                throw new Error(
                    `Primary key column "${column}" does not exist in source table "${sourceSchema}"."${sourceTable}"`
                );
            }
        }

        const targetColumnSet = new Set(targetColumns);

        for (const column of primaryKey) {
            if (!targetColumnSet.has(column)) {
                throw new Error(
                    `Primary key column "${column}" does not exist in target table "${targetSchema}"."${targetTable}"`
                );
            }
        }

        return new TableSyncPlan({
            sourceSchema: assertValidIdentifier(sourceSchema, 'schema'),
            sourceTable,
            targetSchema: assertValidIdentifier(targetSchema, 'schema'),
            targetTable,
            columns: sourceColumns.filter((column) => targetColumnSet.has(column)),
            ignoredColumns: sourceColumns.filter((column) => !targetColumnSet.has(column)),
            primaryKey,
            where: table.where,
        });
    }

    get sourceSchema() {
        return this.#sourceSchema;
    }

    get sourceTable() {
        return this.#sourceTable;
    }

    get targetSchema() {
        return this.#targetSchema;
    }

    get targetTable() {
        return this.#targetTable;
    }

    get columns() {
        return [...this.#columns];
    }

    get ignoredColumns() {
        return [...this.#ignoredColumns];
    }

    get primaryKey() {
        return [...this.#primaryKey];
    }

    get where() {
        return this.#where;
    }

    /**
     * Columns updated on conflict — every synced column except the primary key.
     * Empty when every synced column is part of the primary key — callers must then use DO NOTHING.
     *
     * @returns {string[]} The updatable column names.
     */
    get updatableColumns() {
        return this.#columns.filter((column) => !this.#primaryKey.includes(column));
    }
}
