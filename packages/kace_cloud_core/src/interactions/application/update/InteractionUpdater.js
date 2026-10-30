import { CustomError } from '../../../shared/index.js';
import { InteractionResponse } from '../InteractionResponse.js';
import { InteractionFinderDomain } from '../../domain/InteractionFinderDomain.js';

const reviewLockFields = new Set(['in_review', 'start_review_at', 'start_review_by']);

function withoutReviewLockFields(updateDto = {}) {
    return Object.fromEntries(Object.entries(updateDto).filter(([key]) => !reviewLockFields.has(key)));
}

export class InteractionUpdater {
    /** @type {KnexInteractionRepository} is initialized in the constructor */
    #repository;
    /** @type {InteractionFinderDomain} is initialized in the constructor */
    #finder;

    /**
     *
     * @param {KnexInteractionRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new InteractionFinderDomain(repository);
    }

    /**
     * Update interaction data by id
     * @param {object} updateDto data object for update
     * @param {string} id id for update
     */
    async execute(updateDto, id, userId) {
        const interaction = await this.#finder.execute(id);

        if (interaction === null) {
            throw new CustomError(`The interaction you are trying update does not exist`, 404);
        }

        const safeUpdateDto = withoutReviewLockFields(updateDto);

        if (safeUpdateDto.is_closed === true) {
            safeUpdateDto.closed_by = userId;
            safeUpdateDto.closed_at = new Date().toISOString();
        }

        const originalValues = interaction.toJson();

        interaction.update(safeUpdateDto);

        if (Object.keys(interaction.changedAttributes).length === 0) {
            return new InteractionResponse(interaction);
        }

        await this.#repository.update(interaction);
        await this.#repository.saveHistory(interaction, originalValues);

        interaction.flushChanges();

        return new InteractionResponse(interaction);
    }
}
