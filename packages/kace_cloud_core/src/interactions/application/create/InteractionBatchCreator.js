import { CustomError } from '../../../shared/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { Interaction } from '../../domain/Interaction.js';
import { InteractionEmailAlreadyLinkedError } from '../../domain/InteractionEmailAlreadyLinkedError.js';

function isEmailLinkUniqueViolation(error) {
    const message = error?.message ?? '';
    const constraint = error?.constraint ?? '';

    return (
        constraint === 'interactions_email_id_unique' ||
        /interactions_email_id_unique/i.test(message) ||
        (/unique/i.test(message) && /email_id/i.test(message))
    );
}

export class InteractionBatchCreator {
    /** @type {KnexInteractionRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexInteractionRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Creates several Interaction objects within a single transaction (all-or-nothing).
     *
     * @param {Object[]} dtos - List of data transfer objects, each with the properties for an Interaction.
     * @returns {Promise<string[]>} A promise that resolves to the list of created interaction ids.
     */
    async execute(dtos) {
        if (!Array.isArray(dtos) || dtos.length === 0) {
            throw new CustomError('dtos must be a non-empty array', 400);
        }

        const interactions = dtos.map((dto) => Interaction.create(dto));

        // Ids are generated server-side (uuid v4), so a PK collision is not a case worth
        // spending a SELECT per item on: the insert itself is the guard.
        const transaction = await this.#repository.startTransaction();
        try {
            this.#assertNoDuplicatedEmailInBatch(interactions);
            await this.#assertEmailsNotLinked(interactions, transaction);

            for (const interaction of interactions) {
                await this.#repository.save(interaction, transaction);
                await this.#repository.saveHistory(interaction, null, transaction);
            }
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            Helper.logError('Interaction batch creation failed:', error);
            if (isEmailLinkUniqueViolation(error)) {
                throw new InteractionEmailAlreadyLinkedError({});
            }
            throw error;
        }

        return interactions.map((interaction) => interaction.id.value);
    }

    /** Two interactions of the same request cannot link the same email. */
    #assertNoDuplicatedEmailInBatch(interactions) {
        const seenEmailIds = new Set();

        for (const emailId of this.#emailIdsOf(interactions)) {
            if (seenEmailIds.has(emailId)) {
                throw new InteractionEmailAlreadyLinkedError({ emailId });
            }
            seenEmailIds.add(emailId);
        }
    }

    /**
     * Rejects the batch when any email is already linked to a persisted interaction. The read runs
     * on the transaction so it sees a consistent snapshot with the inserts that follow.
     */
    async #assertEmailsNotLinked(interactions, transaction) {
        const emailIds = [...new Set(this.#emailIdsOf(interactions))];
        if (emailIds.length === 0) return;

        const linkedInteractions = await this.#repository.findByEmailIds(emailIds, { trx: transaction });
        const [existingInteraction] = linkedInteractions ?? [];
        if (existingInteraction) {
            throw new InteractionEmailAlreadyLinkedError({
                emailId: existingInteraction.email_id.value,
                interactionId: existingInteraction.id.value,
            });
        }
    }

    #emailIdsOf(interactions) {
        return interactions.map((interaction) => interaction.email_id.value).filter(Boolean);
    }
}
