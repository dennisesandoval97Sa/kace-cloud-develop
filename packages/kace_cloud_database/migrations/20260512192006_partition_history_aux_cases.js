import { partitionTable, restoreToNonPartitioned } from '../utils/partition-helpers.js';

export async function up(knex) {
    await partitionTable(knex, {
        sourceTable: 'history_aux_cases',
        partitionColumn: 'created_at',
        secondaryIndexes: [
            {
                name: 'history_aux_cases_entity_id_created_at_idx',
                columns: ['entity_id', 'created_at'],
            },
        ],
        foreignKeys: [],
    });
}

export async function down(knex) {
    await restoreToNonPartitioned(knex, {
        sourceTable: 'history_aux_cases',
        schemaBuilder: (table) => {
            table.string('id', 36).primary();
            table.string('entity_id', 36).notNullable();
            table.jsonb('changed_attributes');
            table.jsonb('new_attributes');
            table.jsonb('original_attributes');
            table.timestamp('created_at');
            table.string('created_by', 36);
        },
    });
}
