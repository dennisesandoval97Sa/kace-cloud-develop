import { CustomError } from '../../../shared/index.js';
import { Interaction } from '../../domain/Interaction.js';
import { InteractionFinderDomain } from '../../domain/InteractionFinderDomain.js';
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

export class InteractionCreator {
    /** @type {KnexInteractionRepository} is initialized in the constructor*/
    #repository;
    /** @type {InteractionFinderDomain} is initialized in the constructor*/
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
     *
     * @param {object} dto data for insert a new interaction
     * @returns {Promise<Any>}
     */
    async execute(dto) {
        if (dto === null || dto === undefined) throw new CustomError('dto cannot be null or undefined', 400);

        const creator = Interaction.create(dto);
        const result = await this.#finder.execute(creator.id.value);
        if (result) {
            throw new CustomError(`Interaction with id ${creator.id.value} already exists`, 400);
        }

        const emailId = creator.email_id.value;
        if (emailId) {
            const existingInteraction = await this.#repository.findByEmailId(emailId);
            if (existingInteraction) {
                throw new InteractionEmailAlreadyLinkedError({
                    emailId,
                    interactionId: existingInteraction.id.value,
                });
            }
        }

        try {
            await this.#repository.save(creator);
        } catch (error) {
            if (emailId && isEmailLinkUniqueViolation(error)) {
                const existingInteraction = await this.#repository.findByEmailId(emailId);
                throw new InteractionEmailAlreadyLinkedError({
                    emailId,
                    interactionId: existingInteraction?.id?.value ?? null,
                });
            }

            throw error;
        }
        await this.#repository.saveHistory(creator);

        return creator;
    }
}
