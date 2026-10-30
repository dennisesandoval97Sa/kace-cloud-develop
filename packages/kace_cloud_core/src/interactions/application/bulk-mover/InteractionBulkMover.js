import { CustomError } from '../../../shared/index.js';
import { BulkInteractionValidator } from '../../domain/BulkInteractionValidator.js';

function userIdValue(user) {
    return typeof user === 'string' ? user : (user?.id?.value ?? user?.id);
}

export class InteractionBulkMover {
    #interactionRepository;
    #user;

    constructor(interactionRepository, user) {
        this.#interactionRepository = interactionRepository;
        this.#user = user;
    }

    async execute({ interaction_ids, workspace_id }, activeGroupScope = null) {
        const uniqueInteractionIds = BulkInteractionValidator.dedupeAndValidateCount(interaction_ids);
        let updatedCount = 0;

        await this.#interactionRepository.withTransaction(async (trx) => {
            let interactions;
            let workspace;
            if (activeGroupScope) {
                interactions = await this.#interactionRepository.findByIdsForActiveGroup(
                    uniqueInteractionIds,
                    activeGroupScope,
                    { trx, forUpdate: true }
                );
                if (interactions.length !== uniqueInteractionIds.length) {
                    throw new CustomError('Interaction not found', 404);
                }

                workspace = await this.#interactionRepository.findEligibleAgentMoveDestinationById(workspace_id, {
                    trx,
                    forUpdate: true,
                });
            } else {
                workspace = await this.#interactionRepository.findActiveWorkspaceById(workspace_id, { trx });
                if (workspace) {
                    interactions = await this.#interactionRepository.findByIds(uniqueInteractionIds, {
                        trx,
                        forUpdate: true,
                    });
                    BulkInteractionValidator.ensureAllFound(uniqueInteractionIds, interactions);
                }
            }
            if (!workspace) {
                throw new CustomError(
                    activeGroupScope ? 'Interaction not found' : 'Destination workspace does not exist or is inactive',
                    404
                );
            }
            if (activeGroupScope && interactions.some((interaction) => interaction.workspace_id === workspace_id)) {
                throw new CustomError('Interaction not found', 404);
            }

            BulkInteractionValidator.ensureCanMove(interactions, workspace_id);

            const interactionsToMove = interactions.filter((interaction) => interaction.workspace_id !== workspace_id);
            const interactionIdsToMove = interactionsToMove.map((interaction) => interaction.id);
            const values = {
                workspace_id,
                updated_at: new Date().toISOString(),
                updated_by: userIdValue(this.#user),
            };

            await this.#interactionRepository.bulkMove(interactionIdsToMove, values, { trx });
            await this.#interactionRepository.bulkMoveLinkedEmails(interactionsToMove, values, { trx });
            await this.#interactionRepository.bulkSaveInteractionHistory(interactionsToMove, values, { trx });
            updatedCount = interactionIdsToMove.length;
        });

        return { updated: updatedCount };
    }
}
