import { Helper, KnexRepository } from '../../shared/index';
import { LABELS } from '../domain/labels.js';
import { BLACKLIST_TABLES } from '../domain/BlacklistTables.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';

export class KnexFieldListRepository extends KnexRepository {
    /**
     * @param {import('knex').Knex.Config|import('knex').Knex} config
     * @param {import('knex').Knex.Config|null} [readerConfig] Optional replica config. This service
     *     is read-only (metadata queries), so all queries run on the reader pool.
     */
    constructor(config, readerConfig = null) {
        super(config, '', readerConfig);
    }

    async getFieldList(tableName) {
        try {
            // Read-only metadata query → reader pool. Use this.reader (the Knex instance) directly,
            // not the this.read.table() facade, because the queries reference information_schema
            // tables with explicit names and raw subqueries (the facade would qualify with the tenant schema).
            const reader = this.reader;
            /**
             * Para que un usuario pueda consultar la estructura general de la base de datos debe tener los siguientes permisos
             * CONNECT - Permite al usuario conectarse a la base de datos
             * USAGE - Permite al usuario acceder al esquema (sin leer ni modificar tablas).
             * SELECT - Permite al usuario consultar las tablas y vistas
             */
            const fieldListQuery = reader('information_schema.columns AS col')
                .select(
                    'col.column_name',
                    'col.data_type',
                    'col.character_maximum_length',
                    reader.raw('COALESCE(fk.foreign_table_name, null) AS relation')
                )
                .leftJoin(
                    reader
                        .select('kcu.column_name', 'ccu.table_name AS foreign_table_name')
                        .from('information_schema.table_constraints AS tc')
                        .join('information_schema.key_column_usage AS kcu', function () {
                            this.on('tc.constraint_name', '=', 'kcu.constraint_name').andOn(
                                'tc.table_schema',
                                '=',
                                'kcu.table_schema'
                            );
                        })
                        .join(
                            'information_schema.constraint_column_usage AS ccu',
                            'ccu.constraint_name',
                            '=',
                            'tc.constraint_name'
                        )
                        .where('tc.constraint_type', 'FOREIGN KEY')
                        .andWhere('tc.table_name', tableName)
                        .andWhere('tc.table_schema', this.schema)
                        .groupBy('kcu.column_name', 'ccu.table_name')
                        .as('fk'),
                    'col.column_name',
                    'fk.column_name'
                )
                .where({ 'col.table_name': tableName, 'col.table_schema': this.schema });

            Helper.logDebug('KnexFieldListRepository.getFieldList query:', fieldListQuery.toQuery());
            const fieldListDB = await fieldListQuery;

            return fieldListDB.map((item) => ({
                ...item,
                data_type: this.#mapPostgresToJavaScriptType(item.data_type),
                label: LABELS[item.column_name] ?? 'undefined',
                relation: item.relation ? `/${item.relation}/{id}` : null,
            }));
        } catch (error) {
            Helper.logError('Error getting field list', error);
            throw new QueryDBError('find');
        }
    }

    #mapPostgresToJavaScriptType = (postgresType) => {
        if (!postgresType) return postgresType;

        const type = postgresType.toLowerCase();

        if (type.startsWith('character varying') || type === 'text') {
            return 'String';
        }

        switch (type) {
            case 'jsonb':
            case 'json':
                return 'Object';

            case 'timestamp with time zone':
            case 'timestamp without time zone':
                return 'Date';

            case 'bigint':
            case 'integer':
            case 'smallint':
            case 'real':
            case 'double precision':
                return 'Number';

            case 'boolean':
                return 'Boolean';

            default:
                return postgresType;
        }
    };

    /**
     * Método optimizado que obtiene todas las tablas con sus campos en una sola consulta
     * @returns {Promise<Object>} Objeto donde las claves son nombres de tabla y los valores son arrays de campos
     * @example
     * {
     *   "usuarios": [
     *     { column_name: "id", data_type: "Number", ... },
     *     { column_name: "nombre", data_type: "String", ... }
     *   ],
     *   "casos": [
     *     { column_name: "id", data_type: "Number", ... },
     *     { column_name: "titulo", data_type: "String", ... }
     *   ]
     * }
     */
    async listTables() {
        try {
            const reader = this.reader;
            const query = reader('information_schema.tables AS t')
                .select(
                    't.table_name',
                    'col.column_name',
                    'col.data_type',
                    'col.character_maximum_length',
                    reader.raw('COALESCE(fk.foreign_table_name, null) AS relation')
                )
                .leftJoin('information_schema.columns AS col', function () {
                    this.on('col.table_name', '=', 't.table_name').andOn('col.table_schema', '=', 't.table_schema');
                })
                .leftJoin(
                    reader
                        .select('tc.table_name', 'kcu.column_name', 'ccu.table_name AS foreign_table_name')
                        .from('information_schema.table_constraints AS tc')
                        .join('information_schema.key_column_usage AS kcu', function () {
                            this.on('tc.constraint_name', '=', 'kcu.constraint_name').andOn(
                                'tc.table_schema',
                                '=',
                                'kcu.table_schema'
                            );
                        })
                        .join(
                            'information_schema.constraint_column_usage AS ccu',
                            'ccu.constraint_name',
                            '=',
                            'tc.constraint_name'
                        )
                        .where('tc.constraint_type', 'FOREIGN KEY')
                        .andWhere('tc.table_schema', this.schema)
                        .as('fk'),
                    function () {
                        this.on('col.table_name', '=', 'fk.table_name').andOn('col.column_name', '=', 'fk.column_name');
                    }
                )
                .where('t.table_schema', this.schema)
                .whereIn('t.table_type', ['BASE TABLE', 'VIEW'])
                .whereNotIn('t.table_name', BLACKLIST_TABLES)
                .orderBy(['t.table_name', 'col.column_name']);

            Helper.logDebug('KnexFieldListRepository.listTables query:', query.toQuery());
            const results = await query;

            const tablesObject = {};

            results.forEach((row) => {
                if (!row.column_name) return;

                const tableName = row.table_name;

                if (!tablesObject[tableName]) {
                    tablesObject[tableName] = [];
                }

                const field = {
                    column_name: row.column_name,
                    data_type: this.#mapPostgresToJavaScriptType(row.data_type),
                    character_maximum_length: row.character_maximum_length,
                    label: LABELS[row.column_name] ?? 'undefined',
                    relation: row.relation ? `/${row.relation}/{id}` : null,
                };

                tablesObject[tableName].push(field);
            });

            return tablesObject;
        } catch (error) {
            Helper.logError('Error getting tables with fields', error);
            throw new QueryDBError('list-tables-with-fields');
        }
    }

    async getAllTables() {
        try {
            const query = this.reader.raw(
                `SELECT
                    n.nspname AS table_schema,
                    c.relname AS table_name,
                    a.attnum AS column_position,
                    a.attname AS column_name,
                    format_type(a.atttypid, a.atttypmod) AS data_type,
                    CASE
                        WHEN a.atttypmod > 4 THEN a.atttypmod - 4
                        ELSE NULL
                    END AS max_length
                FROM pg_attribute a
                JOIN pg_class c ON a.attrelid = c.oid
                JOIN pg_namespace n ON c.relnamespace = n.oid
                WHERE n.nspname = ?
                  AND c.relkind IN ('r', 'v', 'p')
                  AND a.attnum > 0
                  AND NOT a.attisdropped
                  AND c.relname NOT IN (${BLACKLIST_TABLES.map(() => '?').join(', ')})
                ORDER BY c.relname ASC, a.attnum ASC`,
                [this.schema, ...BLACKLIST_TABLES]
            );

            Helper.logDebug('KnexFieldListRepository.getAllTables query:', query.toString());
            const { rows: results } = await query;

            const tablesObject = {};
            results.forEach((row) => {
                if (!row.column_name) return;

                const tableName = row.table_name;

                if (!tablesObject[tableName]) {
                    tablesObject[tableName] = [];
                }

                const field = {
                    column_name: row.column_name,
                    data_type: this.#mapPostgresToJavaScriptType(row.data_type),
                    character_maximum_length: row.character_maximum_length,
                    label: LABELS[row.column_name] ?? 'undefined',
                    relation: row.relation ? `/${row.relation}/{id}` : null,
                };

                tablesObject[tableName].push(field);
            });

            return tablesObject;
        } catch (e) {
            Helper.logError('Error getting tables with fields', e);
            throw new QueryDBError('list-tables-with-fields');
        }
    }
}
