import { partitionTable, restoreToNonPartitioned } from '../utils/partition-helpers.js';

export async function up(knex) {
    await partitionTable(knex, {
        sourceTable: 'history_cases',
        partitionColumn: 'created_at',
        secondaryIndexes: [
            {
                name: 'history_cases_entity_id_created_at_idx',
                columns: ['entity_id', 'created_at'],
            },
        ],
        foreignKeys: [
            {
                column: 'entity_id',
                refTable: 'cases',
                refColumn: 'id',
                constraintName: 'history_cases_entity_id_foreign',
            },
        ],
    });
}

export async function down(knex) {
    await restoreToNonPartitioned(knex, {
        sourceTable: 'history_cases',
        schemaBuilder: (table) => {
            table.string('id', 36).primary();
            table.string('entity_id', 36).notNullable();
            table.jsonb('changed_attributes');
            table.jsonb('new_attributes');
            table.jsonb('original_attributes');
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.string('created_by', 36);
            table.string('updated_by', 36);
            table.foreign('entity_id').references('cases.id');
        },
    });
}
