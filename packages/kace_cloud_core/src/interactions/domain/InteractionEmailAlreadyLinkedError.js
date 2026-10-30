import { CustomError } from '../../shared/errors/CustomError.js';
import { INTERACTION_EMAIL_ALREADY_LINKED } from '@kace/error-codes';

export class InteractionEmailAlreadyLinkedError extends CustomError {
    constructor({ emailId, interactionId } = {}) {
        super('An interaction already exists for the provided email_id.', 409, [], INTERACTION_EMAIL_ALREADY_LINKED);
        this.emailId = emailId ?? null;
        this.interactionId = interactionId ?? null;
    }

    toPublicData() {
        return {
            email_id: this.emailId,
            interaction_id: this.interactionId,
        };
    }
}
