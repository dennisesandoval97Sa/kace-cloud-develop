import { BulkInteractionValidator } from '../../domain/BulkInteractionValidator.js';

function userIdValue(user) {
    return typeof user === 'string' ? user : (user?.id?.value ?? user?.id);
}

export class InteractionBulkDeleter {
    #interactionRepository;
    #literalRepository;
    #user;

    constructor(interactionRepository, literalRepository, user) {
        this.#interactionRepository = interactionRepository;
        this.#literalRepository = literalRepository;
        this.#user = user;
    }

    async execute({ interaction_ids, motive }) {
        const uniqueInteractionIds = BulkInteractionValidator.dedupeAndValidateCount(interaction_ids);
        await BulkInteractionValidator.ensureValidMotive(this.#literalRepository, motive);

        await this.#interactionRepository.withTransaction(async (trx) => {
            const interactions = await this.#interactionRepository.findByIds(uniqueInteractionIds, {
                trx,
                forUpdate: true,
            });
            BulkInteractionValidator.ensureAllFound(uniqueInteractionIds, interactions);
            BulkInteractionValidator.ensureCanDelete(interactions);

            const now = new Date().toISOString();
            const userId = userIdValue(this.#user);
            const values = {
                deleted_at: now,
                deleted_by: userId,
                delete_observation: motive,
            };

            await this.#interactionRepository.bulkDelete(uniqueInteractionIds, values, { trx });
            await this.#interactionRepository.bulkSoftDeleteLinkedEmailAggregate(interactions, values, { trx });
            await this.#interactionRepository.bulkSaveInteractionHistory(interactions, values, { trx });
        });

        return { updated: uniqueInteractionIds.length };
    }
}
