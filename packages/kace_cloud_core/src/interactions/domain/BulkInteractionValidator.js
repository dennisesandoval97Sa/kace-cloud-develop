import { CustomError, ValidationFailError } from '../../shared/index.js';

const MAX_BATCH_SIZE = 500;
const MOTIVE_MODEL = 'interactions';
// Product decision: close and delete motives intentionally share this literal path.
const SHARED_CLOSE_DELETE_MOTIVE_FIELD = 'closed_observation';

export class BulkInteractionValidator {
    static dedupeAndValidateCount(interactionIds) {
        if (!Array.isArray(interactionIds)) {
            throw new ValidationFailError('interaction_ids must be an array', 'interaction_ids');
        }

        const uniqueInteractionIds = [...new Set(interactionIds)];

        if (uniqueInteractionIds.length < 1 || uniqueInteractionIds.length > MAX_BATCH_SIZE) {
            throw new ValidationFailError(
                'interaction_ids batch size after dedupe must be between 1 and 500',
                'interaction_ids'
            );
        }

        return uniqueInteractionIds;
    }

    static ensureAllFound(interactionIds, interactions) {
        if (interactions.length === interactionIds.length) return;

        const foundIds = new Set(interactions.map((interaction) => interaction.id));
        const missingIds = interactionIds.filter((id) => !foundIds.has(id));
        throw new CustomError(
            `Interactions not found: ${missingIds.join(', ')}. Select existing interactions and retry.`,
            404
        );
    }

    static ensureCanMove(interactions, destinationWorkspaceId) {
        const deletedInteractions = interactions.filter(
            (interaction) => interaction.deleted_at !== null || interaction.deleted_by !== null
        );
        if (deletedInteractions.length > 0) {
            throw new CustomError('Some interactions are deleted', 400);
        }

        const everyInteractionAlreadyInDestination = interactions.every(
            (interaction) => interaction.workspace_id === destinationWorkspaceId
        );

        if (everyInteractionAlreadyInDestination) {
            throw new CustomError('Interactions are already in the destination workspace', 400);
        }
    }

    static ensureCanClose(interactions) {
        const deletedInteractions = interactions.filter(
            (interaction) => interaction.deleted_at !== null || interaction.deleted_by !== null
        );
        if (deletedInteractions.length > 0) {
            throw new CustomError('Some interactions are deleted', 400);
        }

        const closedInteractions = interactions.filter((interaction) => Boolean(interaction.is_closed) === true);
        if (closedInteractions.length > 0) {
            throw new CustomError('Some interactions are already closed', 400);
        }
    }

    static ensureCanDelete(interactions) {
        const deletedInteractions = interactions.filter(
            (interaction) => interaction.deleted_at !== null || interaction.deleted_by !== null
        );
        if (deletedInteractions.length > 0) {
            throw new CustomError('Some interactions are already deleted', 400);
        }
    }

    static async ensureValidMotive(literalRepository, motive) {
        if (typeof motive !== 'string' || motive.length === 0) {
            throw new CustomError('motive is required', 400);
        }

        const literal = await literalRepository.findActiveOptionByPath(
            MOTIVE_MODEL,
            SHARED_CLOSE_DELETE_MOTIVE_FIELD,
            motive
        );
        if (!literal) {
            throw new CustomError('Invalid interaction motive', 400);
        }
    }

    static async findAndValidateInteractions(repository, interactionIds, { trx, forUpdate } = {}) {
        const uniqueInteractionIds = this.dedupeAndValidateCount(interactionIds);
        const interactions = await repository.findByIds(uniqueInteractionIds, { trx, forUpdate });
        this.ensureAllFound(uniqueInteractionIds, interactions);
        return { uniqueInteractionIds, interactions };
    }
}
