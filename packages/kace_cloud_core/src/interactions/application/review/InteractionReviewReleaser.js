import { CustomError } from '../../../shared/index.js';
import { Interaction } from '../../domain/Interaction.js';
import { InteractionResponse } from '../InteractionResponse.js';

function userIdValue(user) {
    return typeof user === 'string' ? user : (user?.id?.value ?? user?.id);
}

function hasPermission(user, role, moduleId, permissionName) {
    try {
        return Boolean(user?.hasPermission?.(role, moduleId, permissionName));
    } catch {
        return false;
    }
}

function canReleaseAnyReview(user) {
    return hasPermission(user, 'administrador', 'interactions', 'InteractionsUpdate');
}

export class InteractionReviewReleaser {
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
            if (!row.in_review) {
                resultRow = row;
                return;
            }

            const userId = userIdValue(this.#user);
            if (row.start_review_by !== userId && !canReleaseAnyReview(this.#user)) {
                throw new CustomError('You do not have permission to release this interaction review', 403);
            }

            const now = new Date().toISOString();
            const values = {
                in_review: false,
                start_review_at: null,
                start_review_by: null,
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
