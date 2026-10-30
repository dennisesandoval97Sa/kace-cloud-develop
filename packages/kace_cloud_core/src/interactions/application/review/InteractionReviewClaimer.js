import { CustomError } from '../../../shared/index.js';
import { Interaction } from '../../domain/Interaction.js';
import { InteractionResponse } from '../InteractionResponse.js';

function userIdValue(user) {
    return typeof user === 'string' ? user : (user?.id?.value ?? user?.id);
}

export class InteractionReviewClaimer {
    #interactionRepository;
    #user;

    constructor(interactionRepository, user) {
        this.#interactionRepository = interactionRepository;
        this.#user = user;
    }

    async execute(interactionId, activeGroupScope = null) {
        let resultRow;

        await this.#interactionRepository.withTransaction(async (trx) => {
            let row;
            if (activeGroupScope) {
                row = await this.#interactionRepository.findByIdForActiveGroup(interactionId, activeGroupScope, {
                    trx,
                    forUpdate: true,
                });
            } else {
                row = await this.#interactionRepository.findByIdForReview(interactionId, {
                    trx,
                    forUpdate: true,
                });
            }
            if (!row) {
                throw new CustomError('Interaction not found', 404);
            }
            if (row.is_closed) {
                throw new CustomError('Closed interactions cannot be claimed for review', 400);
            }

            const userId = userIdValue(this.#user);
            if (row.in_review && row.start_review_by === userId) {
                resultRow = row;
                return;
            }
            if (row.in_review) {
                throw new CustomError('Interaction is already in review by another user', 409);
            }

            const now = new Date().toISOString();
            const values = {
                in_review: true,
                start_review_at: now,
                start_review_by: userId,
                updated_at: now,
                updated_by: userId,
            };

            await this.#interactionRepository.updateReviewFields(interactionId, values, { trx });
            await this.#interactionRepository.bulkSaveInteractionHistory([row], values, { trx });
            resultRow = { ...row, ...values };
        });

        return new InteractionResponse(new Interaction(resultRow)).toJson();
    }
}
