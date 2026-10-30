/**
 * Compute the target partition (current month + 2) so we always stay one extra month ahead
 * of writes, even if the cron skips a run.
 *
 * @param {Date} now
 * @param {string} tableName  parent partitioned table name
 * @returns {{ name: string, fromDate: string, toDate: string }}
 */
export function computeTargetPartition(now, tableName) {
    const fromMonthIndex = now.getUTCMonth() + 2;
    const fromYear = now.getUTCFullYear() + Math.floor(fromMonthIndex / 12);
    const fromMonth = (fromMonthIndex % 12) + 1;

    const toMonthIndex = fromMonthIndex + 1;
    const toYear = now.getUTCFullYear() + Math.floor(toMonthIndex / 12);
    const toMonth = (toMonthIndex % 12) + 1;

    const fromMonthPadded = String(fromMonth).padStart(2, '0');
    const toMonthPadded = String(toMonth).padStart(2, '0');

    return {
        name: `${tableName}_${fromYear}_${fromMonthPadded}`,
        fromDate: `${fromYear}-${fromMonthPadded}-01`,
        toDate: `${toYear}-${toMonthPadded}-01`,
    };
}

/**
 * Build the CREATE TABLE IF NOT EXISTS DDL for a new monthly partition.
 *
 * @param {{ name: string, fromDate: string, toDate: string }} partition
 * @param {string} tableName  parent partitioned table name
 * @returns {string}
 */
export function buildCreatePartitionSql({ name, fromDate, toDate }, tableName) {
    return `CREATE TABLE IF NOT EXISTS ${name} PARTITION OF ${tableName} FOR VALUES FROM ('${fromDate}') TO ('${toDate}')`;
}
