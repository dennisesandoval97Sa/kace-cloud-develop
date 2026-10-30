import { BulkInteractionValidator } from '../../domain/BulkInteractionValidator.js';
import { CustomError } from '../../../shared/index.js';

function userIdValue(user) {
    return typeof user === 'string' ? user : (user?.id?.value ?? user?.id);
}

export class InteractionBulkCloser {
    #interactionRepository;
    #literalRepository;
    #user;

    constructor(interactionRepository, literalRepository, user) {
        this.#interactionRepository = interactionRepository;
        this.#literalRepository = literalRepository;
        this.#user = user;
    }

    async execute({ interaction_ids, motive }, activeGroupScope = null) {
        const uniqueInteractionIds = BulkInteractionValidator.dedupeAndValidateCount(interaction_ids);
        await BulkInteractionValidator.ensureValidMotive(this.#literalRepository, motive);

        await this.#interactionRepository.withTransaction(async (trx) => {
            let interactions;
            if (activeGroupScope) {
                interactions = await this.#interactionRepository.findByIdsForActiveGroup(
                    uniqueInteractionIds,
                    activeGroupScope,
                    { trx, forUpdate: true }
                );
            } else {
                interactions = await this.#interactionRepository.findByIds(uniqueInteractionIds, {
                    trx,
                    forUpdate: true,
                });
            }
            if (activeGroupScope && interactions.length !== uniqueInteractionIds.length) {
                throw new CustomError('Interaction not found', 404);
            }
            if (!activeGroupScope) BulkInteractionValidator.ensureAllFound(uniqueInteractionIds, interactions);
            BulkInteractionValidator.ensureCanClose(interactions);

            const now = new Date().toISOString();
            const userId = userIdValue(this.#user);
            const values = {
                is_closed: true,
                in_review: false,
                closed_at: now,
                closed_by: userId,
                updated_at: now,
                updated_by: userId,
                closed_observation: motive,
            };

            await this.#interactionRepository.bulkClose(uniqueInteractionIds, values, { trx });
            await this.#interactionRepository.bulkSaveInteractionHistory(interactions, values, { trx });
        });

        return { updated: uniqueInteractionIds.length };
    }
}
