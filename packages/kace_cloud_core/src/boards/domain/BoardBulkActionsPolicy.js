import { ValidationFailError } from '@kace/core/src/shared/index.js';
import { BOARD_BULK_ACTIONS_INCOMPATIBLE } from '@kace/error-codes';
import { isCasesLikeEntity } from '@kace/core/src/boards/domain/isCasesLikeEntity.js';

const BULK_ACTIONS_INCOMPATIBLE_MESSAGE =
    'Bulk actions can only be enabled for boards whose primary_entity is "cases" or a cases-like view, without group_by columns or having conditions.';

export class BoardBulkActionsPolicy {
    static validate(params) {
        const hasGroupByColumn = Array.isArray(params?.columns) && params.columns.some((column) => column?.group_by);
        const hasHavingCondition = Array.isArray(params?.havings) && params.havings.length > 0;
        const isIncompatible = !isCasesLikeEntity(params?.primary_entity) || hasGroupByColumn || hasHavingCondition;
        if (isIncompatible && (params?.can_admin_bulk_actions || params?.can_agent_bulk_actions)) {
            throw new ValidationFailError(
                BULK_ACTIONS_INCOMPATIBLE_MESSAGE,
                'bulk_actions',
                [],
                BOARD_BULK_ACTIONS_INCOMPATIBLE
            );
        }
    }

    static validateForUpdate(board, dto) {
        const params = {
            primary_entity: dto.primary_entity !== undefined ? dto.primary_entity : board.primary_entity.value,
            columns: dto.columns !== undefined ? dto.columns : board.columns.value,
            havings: dto.havings !== undefined ? dto.havings : board.havings.value,
            can_admin_bulk_actions:
                dto.can_admin_bulk_actions !== undefined
                    ? dto.can_admin_bulk_actions
                    : board.can_admin_bulk_actions.value,
            can_agent_bulk_actions:
                dto.can_agent_bulk_actions !== undefined
                    ? dto.can_agent_bulk_actions
                    : board.can_agent_bulk_actions.value,
        };
        BoardBulkActionsPolicy.validate(params);
    }
}
