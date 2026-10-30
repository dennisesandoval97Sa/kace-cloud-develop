/**
 * Accumulates per-table sync outcomes and renders the final summary.
 */
export class SyncReport {
    #entries = [];

    /**
     * Records a table that synced successfully.
     *
     * @param {Object} params - Outcome data.
     * @param {string} params.table - Table name.
     * @param {number} params.read - Rows read from the source.
     * @param {number} params.inserted - Rows inserted in the target.
     * @param {number} params.updated - Rows updated in the target.
     * @param {string[]} params.ignoredColumns - Source columns skipped due to drift.
     * @returns {void}
     */
    recordSuccess({ table, read, inserted, updated, ignoredColumns }) {
        this.#entries.push({ ok: true, table, read, inserted, updated, ignoredColumns });
    }

    /**
     * Records a table that failed to sync.
     *
     * @param {Object} params - Outcome data.
     * @param {string} params.table - Table name.
     * @param {Error} params.error - The error raised while syncing.
     * @returns {void}
     */
    recordFailure({ table, error }) {
        this.#entries.push({ ok: false, table, error });
    }

    get hasFailures() {
        return this.#entries.some((entry) => !entry.ok);
    }

    get successCount() {
        return this.#entries.filter((entry) => entry.ok).length;
    }

    get totalCount() {
        return this.#entries.length;
    }

    /**
     * Renders the report as display lines, ending with a summary.
     *
     * @returns {string[]} One line per table plus the summary line.
     */
    toLines() {
        const lines = this.#entries.map((entry) => (entry.ok ? this.#successLine(entry) : this.#failureLine(entry)));
        lines.push(`Resumen: ${this.successCount}/${this.totalCount} tablas OK`);

        return lines;
    }

    #successLine(entry) {
        const base = `✓ ${entry.table} — ${entry.read} filas leídas, ${entry.inserted} insertadas, ${entry.updated} actualizadas`;

        return entry.ignoredColumns.length > 0 ? `${base} (ignoró: ${entry.ignoredColumns.join(', ')})` : base;
    }

    #failureLine(entry) {
        return `✗ ${entry.table} — ERROR: ${entry.error.message}`;
    }
}
