import { SchemaMetadataCache, ValidationFailError } from '@kace/core/src/shared';
import { BULK_REQUIRED_COLUMNS, isCasesLikeEntity } from '@kace/core/src/boards/domain/isCasesLikeEntity.js';

/**
 * Ensures a cases-like board view exposes every column required to run case bulk
 * actions before allowing the board to persist with bulk actions enabled.
 *
 * The real `cases` table always provides these columns, so it is skipped. Only
 * `boards_*` views are introspected (via schema metadata) and blocked when a
 * required column is missing.
 */
export class BoardBulkViewColumnsValidator {
    /**
     * @param {{ connection: import('knex').Knex }} repository - any KnexRepository instance
     */
    constructor(repository) {
        this.repository = repository;
    }

    /**
     * @param {{ primary_entity: string, can_admin_bulk_actions?: boolean, can_agent_bulk_actions?: boolean }} params
     * @returns {Promise<void>}
     */
    async validate({ primary_entity, can_admin_bulk_actions, can_agent_bulk_actions } = {}) {
        const bulkEnabled = can_admin_bulk_actions === true || can_agent_bulk_actions === true;
        if (!bulkEnabled) return;
        if (!isCasesLikeEntity(primary_entity)) return;
        if (primary_entity === 'cases') return;

        const columns = await SchemaMetadataCache.getTableColumns(this.repository.connection, primary_entity);
        const missing = BULK_REQUIRED_COLUMNS.filter((column) => !columns.includes(column));

        if (missing.length) {
            throw new ValidationFailError(
                `The view "${primary_entity}" does not expose the columns required for bulk actions: ${missing.join(', ')}`,
                'bulk_actions'
            );
        }
    }
}
