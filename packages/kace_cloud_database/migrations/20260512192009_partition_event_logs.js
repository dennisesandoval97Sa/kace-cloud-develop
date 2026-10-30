import { partitionTable, restoreToNonPartitioned } from '../utils/partition-helpers.js';

export async function up(knex) {
    await partitionTable(knex, {
        sourceTable: 'event_logs',
        partitionColumn: 'occurred_at',
        secondaryIndexes: [
            {
                name: 'idx_cases_ocurred_at_event_name',
                columns: ['case_id', 'occurred_at', 'event_name'],
            },
        ],
        foreignKeys: [],
    });
}

export async function down(knex) {
    await restoreToNonPartitioned(knex, {
        sourceTable: 'event_logs',
        schemaBuilder: (table) => {
            table.string('id', 36).primary();
            table.string('event_name', 255);
            table.timestamp('occurred_at');
            table.string('initiated_by_user', 36);
            table.string('aggregate_id', 36);
            table.jsonb('body');
            table.string('case_id', 36);
            table.string('client_id', 36);
            table.jsonb('old_data');
            table.index(['case_id', 'occurred_at', 'event_name'], 'idx_cases_ocurred_at_event_name');
        },
    });
}
